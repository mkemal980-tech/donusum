"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Activity, 
  Database, 
  Cpu, 
  Clock, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  TrendingUp,
  Server
} from "lucide-react";
import { toast } from "sonner";

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latency?: number; message?: string };
    memory: { status: string; message?: string };
    responseTime: { status: string; latency?: number };
  };
}

interface HealthLog {
  id: string;
  status: string;
  dbLatency: number | null;
  memoryUsage: number | null;
  responseTime: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

interface Stats {
  total: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  avgDbLatency: number;
  avgMemory: number;
  avgResponseTime: number;
}

export default function MonitoringPage() {
  const [currentHealth, setCurrentHealth] = useState<HealthCheck | null>(null);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState(24); // hours

  const fetchCurrentHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health?log=true');
      const data = await res.json();
      setCurrentHealth(data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: timeRange })
      });
      const data = await res.json();
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, [timeRange]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCurrentHealth(), fetchLogs()]);
    setRefreshing(false);
    toast.success('Veriler güncellendi');
  }, [fetchCurrentHealth, fetchLogs]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchCurrentHealth(), fetchLogs()]);
      setLoading(false);
    };
    init();
  }, [fetchCurrentHealth, fetchLogs]);

  // Auto refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchCurrentHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchCurrentHealth]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="text-[var(--success)]" size={20} />;
      case 'degraded':
        return <AlertTriangle className="text-[var(--warning)]" size={20} />;
      default:
        return <XCircle className="text-[var(--error)]" size={20} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'var(--success)';
      case 'degraded':
        return 'var(--warning)';
      default:
        return 'var(--error)';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}g ${hours}s ${mins}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Sistem İzleme</h1>
          <p className="text-[var(--text-muted)] mt-1">Gerçek zamanlı sistem sağlığı ve performans metrikleri</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[var(--border-soft)]"
            />
            Otomatik yenile (30s)
          </label>
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* Current Status */}
      {currentHealth && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-soft)]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${getStatusColor(currentHealth.status)}20` }}
              >
                {getStatusIcon(currentHealth.status)}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-main)] capitalize">
                  Sistem Durumu: {currentHealth.status === 'healthy' ? 'Sağlıklı' : currentHealth.status === 'degraded' ? 'Düşük Performans' : 'Sorunlu'}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Son kontrol: {new Date(currentHealth.timestamp).toLocaleString('tr-TR')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-[var(--text-muted)]">Uptime</p>
              <p className="text-lg font-semibold text-[var(--accent)]">{formatUptime(currentHealth.uptime)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Database */}
            <div className="bg-[var(--bg-card-2)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database size={18} className="text-[var(--accent)]" />
                <span className="font-medium text-[var(--text-main)]">Veritabanı</span>
                {getStatusIcon(currentHealth.checks.database.status)}
              </div>
              <p className="text-2xl font-bold text-[var(--text-main)]">
                {currentHealth.checks.database.latency || '-'}ms
              </p>
              <p className="text-xs text-[var(--text-muted)]">Yanıt süresi</p>
            </div>

            {/* Memory */}
            <div className="bg-[var(--bg-card-2)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={18} className="text-[var(--accent)]" />
                <span className="font-medium text-[var(--text-main)]">Bellek</span>
                {getStatusIcon(currentHealth.checks.memory.status)}
              </div>
              <p className="text-2xl font-bold text-[var(--text-main)]">
                {currentHealth.checks.memory.message?.match(/\d+%/)?.[0] || '-'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {currentHealth.checks.memory.message?.replace(/\(\d+%\)/, '') || 'Kullanım'}
              </p>
            </div>

            {/* Response Time */}
            <div className="bg-[var(--bg-card-2)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={18} className="text-[var(--accent)]" />
                <span className="font-medium text-[var(--text-main)]">Yanıt Süresi</span>
                {getStatusIcon(currentHealth.checks.responseTime.status)}
              </div>
              <p className="text-2xl font-bold text-[var(--text-main)]">
                {currentHealth.checks.responseTime.latency || '-'}ms
              </p>
              <p className="text-xs text-[var(--text-muted)]">Health check süresi</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-soft)]">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-[var(--success)]" />
              <span className="text-sm text-[var(--text-muted)]">Sağlıklı</span>
            </div>
            <p className="text-2xl font-bold text-[var(--success)]">
              {stats.total > 0 ? Math.round((stats.healthy / stats.total) * 100) : 0}%
            </p>
            <p className="text-xs text-[var(--text-dim)]">{stats.healthy} / {stats.total} kontrol</p>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-soft)]">
            <div className="flex items-center gap-2 mb-2">
              <Database size={18} className="text-[var(--accent)]" />
              <span className="text-sm text-[var(--text-muted)]">Ort. DB Latency</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-main)]">{stats.avgDbLatency}ms</p>
            <p className="text-xs text-[var(--text-dim)]">Son {timeRange} saat</p>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-soft)]">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={18} className="text-[var(--accent)]" />
              <span className="text-sm text-[var(--text-muted)]">Ort. Bellek</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-main)]">{stats.avgMemory}%</p>
            <p className="text-xs text-[var(--text-dim)]">Son {timeRange} saat</p>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-soft)]">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-[var(--accent)]" />
              <span className="text-sm text-[var(--text-muted)]">Ort. Yanıt</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-main)]">{stats.avgResponseTime}ms</p>
            <p className="text-xs text-[var(--text-dim)]">Son {timeRange} saat</p>
          </div>
        </div>
      )}

      {/* Time Range Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-[var(--text-muted)]">Zaman Aralığı:</span>
        {[6, 12, 24, 48, 168].map(hours => (
          <button
            key={hours}
            onClick={() => setTimeRange(hours)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              timeRange === hours
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]'
            }`}
          >
            {hours < 24 ? `${hours}s` : hours === 24 ? '1g' : hours === 48 ? '2g' : '1h'}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-soft)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-soft)]">
          <h3 className="font-semibold text-[var(--text-main)] flex items-center gap-2">
            <Server size={18} />
            Health Check Geçmişi
          </h3>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-card-2)] sticky top-0">
              <tr>
                <th className="text-left p-3 text-sm text-[var(--text-muted)]">Zaman</th>
                <th className="text-left p-3 text-sm text-[var(--text-muted)]">Durum</th>
                <th className="text-left p-3 text-sm text-[var(--text-muted)]">DB Latency</th>
                <th className="text-left p-3 text-sm text-[var(--text-muted)]">Bellek</th>
                <th className="text-left p-3 text-sm text-[var(--text-muted)]">Yanıt</th>
                <th className="text-left p-3 text-sm text-[var(--text-muted)]">Hata</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--text-muted)]">
                    Henüz log kaydı yok. Health check endpoint'i çağrıldıkça loglar burada görünecek.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-[var(--border-soft)] hover:bg-[var(--bg-card-2)]">
                    <td className="p-3 text-sm text-[var(--text-main)]">
                      {new Date(log.checkedAt).toLocaleString('tr-TR')}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                        log.status === 'healthy' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                        log.status === 'degraded' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' :
                        'bg-[var(--error)]/10 text-[var(--error)]'
                      }`}>
                        {log.status === 'healthy' ? <CheckCircle size={12} /> : 
                         log.status === 'degraded' ? <AlertTriangle size={12} /> : 
                         <XCircle size={12} />}
                        {log.status === 'healthy' ? 'Sağlıklı' : log.status === 'degraded' ? 'Düşük' : 'Sorunlu'}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-[var(--text-main)]">{log.dbLatency ?? '-'}ms</td>
                    <td className="p-3 text-sm text-[var(--text-main)]">{log.memoryUsage ?? '-'}%</td>
                    <td className="p-3 text-sm text-[var(--text-main)]">{log.responseTime ?? '-'}ms</td>
                    <td className="p-3 text-sm text-[var(--error)]">{log.errorMessage || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* External Monitoring Info */}
      <div className="bg-[var(--bg-card-2)] rounded-xl p-4 border border-[var(--border-soft)]">
        <h4 className="font-medium text-[var(--text-main)] mb-2">🔗 Harici Monitoring Entegrasyonu</h4>
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Ücretsiz uptime monitoring servisleri ile entegre edebilirsiniz:
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="https://uptimerobot.com" target="_blank" rel="noopener" className="text-sm px-3 py-1 bg-[var(--bg-card)] rounded text-[var(--accent)] hover:underline">
            UptimeRobot (Ücretsiz)
          </a>
          <a href="https://betterstack.com/better-uptime" target="_blank" rel="noopener" className="text-sm px-3 py-1 bg-[var(--bg-card)] rounded text-[var(--accent)] hover:underline">
            Better Uptime
          </a>
          <a href="https://cronitor.io" target="_blank" rel="noopener" className="text-sm px-3 py-1 bg-[var(--bg-card)] rounded text-[var(--accent)] hover:underline">
            Cronitor
          </a>
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-3">
          Endpoint: <code className="bg-[var(--bg-card)] px-2 py-1 rounded">https://app.esgakademi.online/api/health</code>
        </p>
      </div>
    </div>
  );
}
