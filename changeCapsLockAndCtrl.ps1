$hexified = "00,00,00,00,00,00,00,00,03,00,00,00,1d,00,3a,00,3a,00,1d,00,00,00,00,00".Split(',') | % { "0x$_" };

$kblayout = 'HKLM:\System\CurrentControlSet\Control\Keyboard Layout';

New-ItemProperty -Path $kblayout -Name "Scancode Map" -PropertyType Binary -Value ([byte[]]$hexified);