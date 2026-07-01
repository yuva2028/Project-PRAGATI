import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Bell, Filter, Download, CheckCircle, XCircle, AlertTriangle, Info, Loader2, Smartphone, MessageSquare } from 'lucide-react';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SEVERITY_CONFIG = {
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.25)', label: 'Critical', icon: <XCircle size={16} /> },
  high:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', label: 'High',     icon: <AlertTriangle size={16} /> },
  medium:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  label: 'Medium',   icon: <Info size={16} /> },
  low:      { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   label: 'Low',      icon: <CheckCircle size={16} /> },
  info:     { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)', label: 'Info',     icon: <Info size={16} /> },
};

export default function AlertCenter() {
  const { userCoords } = useStore();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [expandedAlert, setExpandedAlert] = useState(null);

  useEffect(() => {
    setLoading(true);
    const params = userCoords ? `?lat=${userCoords.lat}&lng=${userCoords.lng}` : '';

    Promise.all([
      fetch(`${API}/api/alerts${params}`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/alerts/summary${params}`).then(r => r.json()).catch(() => null),
    ]).then(([alertData, summaryData]) => {
      setAlerts(alertData?.alerts || []);
      setSummary(summaryData?.summary || null);
      setLoading(false);
    });
  }, [userCoords]);

  const filteredAlerts = useMemo(() => {
    if (filter === 'ALL') return alerts;
    return alerts.filter(a => a.severity === filter.toLowerCase());
  }, [alerts, filter]);

  const exportCSV = () => {
    const headers = 'ID,Timestamp,Severity,Type,Title,Message,Action,Channel,Acknowledged\n';
    const rows = filteredAlerts.map(a =>
      `"${a.id}","${a.timestamp}","${a.severity}","${a.type}","${a.title}","${a.message.replace(/"/g, '""')}","${a.action}","${a.channel}","${a.acknowledged}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pragati_alerts_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportWebhookJSON = () => {
    const payload = {
      vendor: "twilio_whatsapp_api",
      timestamp: new Date().toISOString(),
      messages: filteredAlerts.map(a => ({
        to: "whatsapp:+91XXXXXXXXXX",
        from: "whatsapp:+14155238886",
        body: `*PRAGATI ALERT: ${SEVERITY_CONFIG[a.severity]?.label || 'INFO'}*\n${a.title}\n${a.message}\nAction: ${a.action}`
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `twilio_webhook_payload_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--blue-500)', marginBottom: '1rem' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading alerts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={24} /> Alert & Notification Center
          </h1>
          <p className="page-subtitle">
            Real-time agricultural monitoring alerts and notification management
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={exportWebhookJSON}
            aria-label="Export Twilio Webhook Payload"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
              color: 'var(--blue-400)', padding: '8px 16px', borderRadius: '8px',
              fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
            }}
          >
            <Smartphone size={14} /> Export Twilio JSON
          </button>
          <button
            onClick={exportCSV}
            aria-label="Export alerts as CSV file"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-main)', padding: '8px 16px', borderRadius: '8px',
              fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer',
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {['critical', 'high', 'medium', 'low', 'info'].map(sev => {
            const config = SEVERITY_CONFIG[sev];
            const count = summary[sev] || 0;
            return (
              <button
                key={sev}
                onClick={() => setFilter(filter === sev.toUpperCase() ? 'ALL' : sev.toUpperCase())}
                className="card-glass"
                role="button"
                aria-label={`Filter by ${sev} severity. ${count} alerts`}
                style={{
                  padding: '1rem',
                  borderLeft: `3px solid ${config.color}`,
                  cursor: 'pointer',
                  background: filter === sev.toUpperCase() ? config.bg : 'var(--card-bg)',
                  border: filter === sev.toUpperCase() ? `1px solid ${config.border}` : '1px solid rgba(255,255,255,0.06)',
                  borderLeftWidth: '3px',
                  borderLeftColor: config.color,
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                  <span style={{ color: config.color }}>{config.icon}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {config.label}
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: config.color }}>{count}</div>
              </button>
            );
          })}
          <div className="card-glass" style={{
            padding: '1rem', borderLeft: '3px solid var(--blue-500)',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Unacknowledged
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--blue-400)' }}>
              {summary.unacknowledged || 0}
            </div>
          </div>
        </div>
      )}

      {/* Notification Channel Mockups */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card-glass" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Smartphone size={20} color="#22c55e" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'white' }}>SMS Alert Service</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Critical stress alerts sent via PMKSY SMS gateway to registered farmer mobile numbers
            </div>
          </div>
          <span style={{
            marginLeft: 'auto', fontSize: '0.65rem', fontWeight: '700',
            background: 'rgba(34,197,94,0.12)', color: '#22c55e',
            padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap',
          }}>
            Ready
          </span>
        </div>

        <div className="card-glass" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageSquare size={20} color="#3b82f6" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'white' }}>WhatsApp Integration</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Advisory messages with maps and charts delivered via WhatsApp Business API
            </div>
          </div>
          <span style={{
            marginLeft: 'auto', fontSize: '0.65rem', fontWeight: '700',
            background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
            padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap',
          }}>
            Prototype
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', gap: '4px', background: 'var(--card-bg)',
          padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-label={`Show ${f.toLowerCase()} severity alerts`}
              style={{
                padding: '4px 10px', borderRadius: '6px', border: 'none',
                background: filter === f ? 'var(--blue-600)' : 'transparent',
                color: filter === f ? 'white' : 'var(--text-muted)',
                fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {f}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 'auto' }}>
          {filteredAlerts.length} alerts
        </span>
      </div>

      {/* Alert Timeline */}
      <div style={{ position: 'relative' }}>
        {/* Timeline line */}
        <div style={{
          position: 'absolute', left: '22px', top: '0', bottom: '0', width: '2px',
          background: 'rgba(255,255,255,0.06)',
        }} />

        {filteredAlerts.map((alert, i) => {
          const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
          const isExpanded = expandedAlert === alert.id;

          return (
            <div
              key={alert.id}
              onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
              role="button"
              tabIndex={0}
              aria-label={`Alert: ${alert.title}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedAlert(isExpanded ? null : alert.id); } }}
              style={{
                display: 'flex', gap: '1rem', marginBottom: '0.5rem',
                padding: '0.75rem 1rem 0.75rem 3rem', position: 'relative',
                background: isExpanded ? config.bg : 'transparent',
                borderRadius: '10px', cursor: 'pointer',
                border: isExpanded ? `1px solid ${config.border}` : '1px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Timeline dot */}
              <div style={{
                position: 'absolute', left: '14px', top: '18px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: config.bg, border: `2px solid ${config.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', zIndex: 1,
              }}>
                {alert.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase',
                    color: config.color, background: config.bg,
                    padding: '1px 6px', borderRadius: '4px',
                    border: `1px solid ${config.border}`,
                  }}>
                    {config.label}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {alert.timestamp_display}
                  </span>
                  {alert.acknowledged && (
                    <CheckCircle size={12} color="#22c55e" style={{ opacity: 0.6 }} />
                  )}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: '600', color: 'white', marginBottom: '0.25rem' }}>
                  {alert.title}
                </div>

                {isExpanded && (
                  <div style={{ animation: 'fadeIn 0.2s ease' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
                      {alert.message}
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>🎯 Action: <strong style={{ color: 'var(--text-main)' }}>{alert.action}</strong></span>
                      <span>📡 Channel: <strong style={{ color: 'var(--text-main)' }}>{alert.channel}</strong></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Time ago */}
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: '2px' }}>
                {alert.hours_ago < 1 ? 'Just now' : alert.hours_ago < 24 ? `${Math.round(alert.hours_ago)}h ago` : `${Math.round(alert.hours_ago / 24)}d ago`}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
