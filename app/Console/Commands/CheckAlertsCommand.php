<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckAlertsCommand extends Command
{
    protected $signature = 'smaca:check-alerts';

    protected $description = 'Evaluate enabled SMACA alert rules against sensor_latest telemetry';

    public function handle(): int
    {
        if (!function_exists('smacaAlertsEnsureLoaded')) {
            $loader = base_path('routes/smaca-alerts.php');
            if (!is_file($loader)) {
                $this->error('Alert loader missing: routes/smaca-alerts.php');

                return self::FAILURE;
            }
            require_once $loader;
        }

        smacaAlertsEnsureLoaded();

        $summary = smacaAlertEvaluator()->run();

        $this->info(sprintf(
            'Alerts check complete. checked=%d triggered=%d updated=%d resolved=%d skipped=%d',
            $summary['checked'],
            $summary['triggered'],
            $summary['updated'],
            $summary['resolved'],
            $summary['skipped']
        ));

        return self::SUCCESS;
    }
}
