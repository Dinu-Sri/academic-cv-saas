<?php
require __DIR__ . '/../app/services/CvDataNormalizer.php';

$cases = [
    ['', '', null, ''],
    ['2020', '2022', null, '2020 -- 2022'],
    ['2020', '2020', null, '2020'],
    ['', '2022', null, '2022'],
    ['2020', '', null, '2020'],
    ['  2019  ', '  2020  ', null, '2019 -- 2020'],
    ['', '', 'Present', ''],
    ['2020', '', 'Present', '2020 -- Present'],
    ['', 'Present', null, 'Present'],
    ['2020', '2022', 'Present', '2020 -- 2022'],
];

$pass = 0; $fail = 0;
foreach ($cases as $c) {
    [$s, $e, $fb, $want] = $c;
    $got = CvDataNormalizer::formatYearRange($s, $e, $fb);
    $ok = $got === $want;
    if ($ok) $pass++; else $fail++;
    $status = $ok ? 'OK  ' : 'FAIL';
    echo sprintf("%s start='%s' end='%s' fb=%s -> '%s' (want '%s')\n",
        $status, $s, $e, var_export($fb, true), $got, $want);
}
echo "\n$pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
