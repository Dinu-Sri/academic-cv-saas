<?php
/**
 * Helper function for flash messages & escaping
 */
function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function old(string $key, string $default = ''): string
{
    $value = $_SESSION['old_input'][$key] ?? $default;
    unset($_SESSION['old_input'][$key]);
    return e($value);
}

function flash_messages(): string
{
    $html = '';
    if (!empty($_SESSION['flash_success'])) {
        $html .= '<div class="alert alert-success alert-dismissible fade show" role="alert">'
            . $_SESSION['flash_success']
            . '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
        unset($_SESSION['flash_success']);
    }
    if (!empty($_SESSION['flash_error'])) {
        $html .= '<div class="alert alert-danger alert-dismissible fade show" role="alert">'
            . $_SESSION['flash_error']
            . '<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>';
        unset($_SESSION['flash_error']);
    }
    return $html;
}
