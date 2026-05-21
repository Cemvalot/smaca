<?php

namespace App\Support;

use Illuminate\Support\Facades\Hash;

/**
 * Mixed-mode password check for legacy plaintext + bcrypt hashes.
 */
final class SmacaPassword
{
    public static function matches(string $plain, string $stored): bool
    {
        if (Hash::info($stored)['algo'] !== null) {
            return Hash::check($plain, $stored);
        }

        return hash_equals($stored, $plain);
    }
}
