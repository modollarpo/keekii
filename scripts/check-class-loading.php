<?php

/**
 * Class-load guard.
 *
 * php -l only parses. It never resolves a class against its parent, so a
 * model that skips an abstract method from BaseModel - which is exactly what
 * Ad did - passes php -l and then throws a fatal the first time anything
 * touches it, taking every request down with a 500. This walks app/ and
 * loads each declared class, interface, trait and enum instead, so that kind
 * of bug fails here rather than in production.
 *
 * Usage: php scripts/check-class-loading.php [directory ...]
 * Defaults to app/. A class that cannot be loaded exits non-zero; a fatal
 * during a load exits 255 with the last "checking" line naming the class.
 *
 * Runs without a database and without booting Laravel.
 */

declare(strict_types=1);

$root = dirname(__DIR__);
require $root.'/vendor/autoload.php';

$dirs = array_slice($argv, 1);
if (!$dirs) {
    $dirs = [$root.'/app'];
}

$checked = 0;

foreach ($dirs as $dir) {
    if (!is_dir($dir)) {
        fwrite(STDERR, "class-load guard: no such directory {$dir}\n");
        exit(1);
    }

    $paths = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
    );
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $paths[] = $file->getPathname();
        }
    }
    sort($paths);

    foreach ($paths as $path) {
        $source = file_get_contents($path);
        if ($source === false) {
            continue;
        }

        // Not anchored to the start of a line: a third of this codebase
        // writes `<?php namespace App\Models;` on one line, and anchoring
        // quietly skipped 54 classes including Album, Track and User.
        if (!preg_match(
            '/(?:\A|<\?php\s+|[\r\n])\s*namespace\s+([^;]+);/',
            $source,
            $namespace,
        )) {
            continue;
        }

        $name = basename($path, '.php');
        if (!preg_match(
            '/(?:\A|<\?php\s+|[\r\n])\s*(?:(?:final|abstract|readonly)\s+)*'.
            '(?:class|interface|trait|enum)\s+'.preg_quote($name, '/').'\b/',
            $source,
        )) {
            // Helper or config file: nothing declared under the file's own
            // name, so there is no PSR-4 class here to load.
            continue;
        }

        $fqcn = trim($namespace[1]).'\\'.$name;

        // Printed before the load attempt: when the class itself is fatal
        // the process dies here, and this is the line that says what broke.
        echo "checking {$fqcn}\n";

        if (
            !class_exists($fqcn)
            && !interface_exists($fqcn)
            && !trait_exists($fqcn)
            && (!function_exists('enum_exists') || !enum_exists($fqcn))
        ) {
            fwrite(STDERR, "class-load guard: {$fqcn} in {$path} did not load\n");
            exit(1);
        }

        $checked++;
    }
}

echo "class-load guard: {$checked} classes loaded\n";
exit(0);
