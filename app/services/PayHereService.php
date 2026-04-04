<?php
/**
 * PayHere Payment Gateway Service
 * Handles hash generation, notification verification, and refund API calls
 */
class PayHereService
{
    private array $config;

    // PayHere known server IPs for webhook verification
    private const PAYHERE_IPS = [
        '175.157.14.7',
        '175.157.14.11',
        '103.123.44.0/24',
    ];

    public function __construct()
    {
        $settings = new SiteSetting();
        $this->config = $settings->getPayHereConfig();
    }

    /**
     * Check if PayHere credentials are configured
     */
    public function isConfigured(): bool
    {
        return !empty($this->config['payhere_merchant_id'])
            && !empty($this->config['payhere_merchant_secret']);
    }

    /**
     * Check if sandbox mode is enabled
     */
    public function isSandbox(): bool
    {
        return ($this->config['payhere_sandbox'] ?? '1') === '1';
    }

    /**
     * Get merchant ID
     */
    public function getMerchantId(): string
    {
        return $this->config['payhere_merchant_id'] ?? '';
    }

    /**
     * Get configured currency
     */
    public function getCurrency(): string
    {
        return $this->config['payhere_currency'] ?? 'USD';
    }

    /**
     * Get PayHere base URL (sandbox or live)
     */
    public function getBaseUrl(): string
    {
        return $this->isSandbox()
            ? 'https://sandbox.payhere.lk'
            : 'https://www.payhere.lk';
    }

    /**
     * Generate MD5 hash for PayHere checkout
     * Formula: strtoupper(md5(merchant_id + order_id + amount + currency + strtoupper(md5(merchant_secret))))
     */
    public function generateHash(string $orderId, float $amount, string $currency): string
    {
        $merchantSecret = $this->config['payhere_merchant_secret'] ?? '';
        $hashedSecret = strtoupper(md5($merchantSecret));

        return strtoupper(md5(
            $this->getMerchantId() .
            $orderId .
            number_format($amount, 2, '.', '') .
            $currency .
            $hashedSecret
        ));
    }

    /**
     * Verify PayHere notification md5sig
     * Formula: strtoupper(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(merchant_secret))))
     */
    public function verifyNotification(array $postData): bool
    {
        $merchantId = $postData['merchant_id'] ?? '';
        $orderId = $postData['order_id'] ?? '';
        $amount = $postData['payhere_amount'] ?? '';
        $currency = $postData['payhere_currency'] ?? '';
        $statusCode = $postData['status_code'] ?? '';
        $receivedSig = $postData['md5sig'] ?? '';

        $merchantSecret = $this->config['payhere_merchant_secret'] ?? '';
        $hashedSecret = strtoupper(md5($merchantSecret));

        $expectedSig = strtoupper(md5(
            $merchantId .
            $orderId .
            $amount .
            $currency .
            $statusCode .
            $hashedSecret
        ));

        return hash_equals($expectedSig, strtoupper($receivedSig));
    }

    /**
     * Verify that the request IP is from PayHere servers
     */
    public function verifyIpWhitelist(?string $ip = null): bool
    {
        // Skip IP check in sandbox mode for testing
        if ($this->isSandbox()) {
            return true;
        }

        $ip = $ip ?? $this->getClientIp();

        foreach (self::PAYHERE_IPS as $allowedIp) {
            if (str_contains($allowedIp, '/')) {
                // CIDR range check
                if ($this->ipInCidr($ip, $allowedIp)) {
                    return true;
                }
            } else {
                if ($ip === $allowedIp) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get the real client IP address
     */
    private function getClientIp(): string
    {
        // Check for proxy/load balancer headers
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            // Take the first IP in the chain (original client)
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            return $_SERVER['HTTP_X_REAL_IP'];
        }
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    /**
     * Check if an IP is within a CIDR range
     */
    private function ipInCidr(string $ip, string $cidr): bool
    {
        [$subnet, $bits] = explode('/', $cidr);
        $ipLong = ip2long($ip);
        $subnetLong = ip2long($subnet);
        $mask = -1 << (32 - (int)$bits);

        return ($ipLong & $mask) === ($subnetLong & $mask);
    }

    /**
     * Get OAuth2 access token for Refund API
     */
    public function getAccessToken(): ?string
    {
        $appId = $this->config['payhere_app_id'] ?? '';
        $appSecret = $this->config['payhere_app_secret'] ?? '';

        if (empty($appId) || empty($appSecret)) {
            return null;
        }

        $credentials = base64_encode($appId . ':' . $appSecret);
        $tokenUrl = $this->getBaseUrl() . '/merchant/v1/oauth/token';

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $tokenUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => 'grant_type=client_credentials',
            CURLOPT_HTTPHEADER => [
                'Authorization: Basic ' . $credentials,
                'Content-Type: application/x-www-form-urlencoded',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$response) {
            return null;
        }

        $data = json_decode($response, true);
        return $data['access_token'] ?? null;
    }

    /**
     * Process a refund via PayHere Refund API
     * Returns: ['success' => bool, 'message' => string, 'data' => array|null]
     */
    public function refundPayment(string $paymentId, ?string $description = null): array
    {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) {
            return [
                'success' => false,
                'message' => 'Failed to get PayHere access token. Check App ID and App Secret.',
                'data' => null,
            ];
        }

        $refundUrl = $this->getBaseUrl() . '/merchant/v1/payment/refund';

        $postFields = ['payment_id' => $paymentId];
        if ($description) {
            $postFields['description'] = $description;
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $refundUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($postFields),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/x-www-form-urlencoded',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            return [
                'success' => false,
                'message' => 'cURL error: ' . $curlError,
                'data' => null,
            ];
        }

        $data = json_decode($response, true);

        if ($httpCode === 200 && isset($data['status']) && (int)$data['status'] === 1) {
            return [
                'success' => true,
                'message' => $data['msg'] ?? 'Refund processed successfully.',
                'data' => $data,
            ];
        }

        return [
            'success' => false,
            'message' => $data['msg'] ?? "Refund failed (HTTP $httpCode).",
            'data' => $data,
        ];
    }

    /**
     * Log payment events for debugging
     */
    public function log(string $message, array $context = []): void
    {
        $logFile = LOG_DIR . '/payhere.log';
        $timestamp = date('Y-m-d H:i:s');
        $contextStr = $context ? ' ' . json_encode($context) : '';
        file_put_contents($logFile, "[$timestamp] $message$contextStr\n", FILE_APPEND | LOCK_EX);
    }
}
