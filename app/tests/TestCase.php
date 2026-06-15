<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    // SQLite :memory: creates a separate DB per PDO handle.
    // The HTTP kernel opens its own handle, so tests would hit an empty DB.
    // A named file is shared across all connections in the same process.
    use RefreshDatabase;

    private static string $dbPath = '/tmp/taverne_test.sqlite';

    public function createApplication()
    {
        $app = parent::createApplication();

        $app['config']->set('database.default', 'sqlite');
        $app['config']->set('database.connections.sqlite', [
            'driver'                  => 'sqlite',
            'database'                => self::$dbPath,
            'prefix'                  => '',
            'foreign_key_constraints' => true,
        ]);
        $app['config']->set('cache.default', 'array');
        $app['config']->set('session.driver', 'array');
        $app['config']->set('queue.default', 'sync');
        $app['config']->set('mail.default', 'array');

        return $app;
    }

    // PHP rule: class method > trait method. Because TestCase both uses RefreshDatabase
    // AND defines this method, our override wins for all subclasses too.
    // Transactions don't span connections in SQLite, so we use migrate:fresh for
    // isolation; all connections (test code + HTTP kernel) share the same file.
    public function refreshDatabase()
    {
        $this->artisan('migrate:fresh', ['--force' => true]);
        $this->app[Kernel::class]->setArtisan(null);
    }
}
