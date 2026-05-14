<?php

class Credit
{
    public const COMPILE_COST = 1;
    public const PDF_IMPORT_APPLY_COST = 3;
    public const PURCHASE_PACK_CREDITS = 250;
    public const PURCHASE_PACK_PRICE = 5.00;

    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    public function balance(int $userId): int
    {
        $stmt = $this->db->prepare('SELECT credit_balance FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $value = $stmt->fetchColumn();
        return $value === false ? 0 : (int) $value;
    }

    public function hasEnough(int $userId, int $amount): bool
    {
        return $this->balance($userId) >= $amount;
    }

    public function debit(int $userId, int $amount, string $source, string $idempotencyKey, array $metadata = []): array
    {
        if ($amount <= 0) {
            throw new InvalidArgumentException('Debit amount must be positive.');
        }

        return $this->record($userId, -$amount, 'debit', $source, $idempotencyKey, $metadata);
    }

    public function credit(int $userId, int $amount, string $source, string $idempotencyKey, array $metadata = []): array
    {
        if ($amount <= 0) {
            throw new InvalidArgumentException('Credit amount must be positive.');
        }

        return $this->record($userId, $amount, 'credit', $source, $idempotencyKey, $metadata);
    }

    private function record(int $userId, int $signedAmount, string $type, string $source, string $idempotencyKey, array $metadata): array
    {
        $idempotencyKey = substr($idempotencyKey, 0, 190);

        try {
            $this->db->beginTransaction();

            $existing = $this->findByKey($idempotencyKey);
            if ($existing) {
                $this->db->commit();
                return ['success' => true, 'already_recorded' => true, 'balance' => (int) $existing['balance_after']];
            }

            $stmt = $this->db->prepare('SELECT credit_balance FROM users WHERE id = ? FOR UPDATE');
            $stmt->execute([$userId]);
            $current = $stmt->fetchColumn();
            if ($current === false) {
                $this->db->rollBack();
                return ['success' => false, 'error' => 'User not found.', 'balance' => 0];
            }

            $current = (int) $current;
            $newBalance = $current + $signedAmount;
            if ($newBalance < 0) {
                $this->db->rollBack();
                return [
                    'success' => false,
                    'error' => 'Not enough credits.',
                    'balance' => $current,
                    'required' => abs($signedAmount),
                ];
            }

            $stmt = $this->db->prepare('UPDATE users SET credit_balance = ? WHERE id = ?');
            $stmt->execute([$newBalance, $userId]);

            $stmt = $this->db->prepare(
                'INSERT INTO credit_transactions
                 (user_id, amount, balance_after, type, source, reference_type, reference_id, idempotency_key, metadata)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $userId,
                $signedAmount,
                $newBalance,
                $type,
                $source,
                $metadata['reference_type'] ?? null,
                isset($metadata['reference_id']) ? (string) $metadata['reference_id'] : null,
                $idempotencyKey,
                json_encode($metadata),
            ]);

            $this->db->commit();
            return ['success' => true, 'already_recorded' => false, 'balance' => $newBalance];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            error_log('Credit.record: ' . $e->getMessage());
            return ['success' => false, 'error' => 'Credit transaction failed.', 'balance' => $this->safeBalance($userId)];
        }
    }

    private function findByKey(string $idempotencyKey): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM credit_transactions WHERE idempotency_key = ? LIMIT 1');
        $stmt->execute([$idempotencyKey]);
        return $stmt->fetch() ?: null;
    }

    private function safeBalance(int $userId): int
    {
        try {
            return $this->balance($userId);
        } catch (Throwable $e) {
            return 0;
        }
    }
}
