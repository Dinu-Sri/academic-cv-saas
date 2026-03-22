<?php
define('BASE_PATH', dirname(__DIR__));
define('APP_PATH', BASE_PATH . '/app');
define('STORAGE_PATH', BASE_PATH . '/storage');
require_once APP_PATH . '/config.php';
require_once APP_PATH . '/Database.php';
require_once APP_PATH . '/lib/fpdf.php';

// Test font loading
$fontpath = APP_PATH . '/lib/font/';
echo "fontpath: $fontpath\n";
echo "file exists: " . (file_exists($fontpath . 'cmunrm.php') ? 'YES' : 'NO') . "\n";

// Try include
$result = @include($fontpath . 'cmunrm.php');
echo "include result: " . ($result ? 'OK' : 'FAIL') . "\n";
echo "name defined: " . (isset($name) ? $name : 'NOT SET') . "\n";

// Try creating FPDF and adding font
echo "\n=== Testing FPDF AddFont ===\n";
try {
    $pdf = new FPDF('P', 'mm', 'A4');
    $pdf->AddFont('CMUSerif', '', 'cmunrm.php');
    echo "AddFont CMUSerif succeeded!\n";
    $pdf->AddFont('CMUSerif', 'B', 'cmunbx.php');
    echo "AddFont CMUSerif Bold succeeded!\n";
    $pdf->AddPage();
    $pdf->SetFont('CMUSerif', '', 12);
    $pdf->Cell(0, 10, 'Test', 0, 1);
    $pdf->Output('F', STORAGE_PATH . '/temp/test_debug.pdf');
    echo "PDF generated successfully!\n";
} catch (\Exception $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}
