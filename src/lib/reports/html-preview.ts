import type { ReportData, ScreeningResultData } from './types'
import type { ReportTemplate } from '@/types/database'

function riskColor(score: number | null): string {
  if (score === null) return '#6B7280'
  if (score >= 80) return '#EF4444'
  if (score >= 60) return '#F97316'
  if (score >= 40) return '#EAB308'
  return '#22C55E'
}

function riskLabel(score: number | null): string {
  if (score === null) return 'Not Scored'
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

function templateTitle(template: ReportTemplate): string {
  switch (template) {
    case 'standard_dd': return 'Due Diligence Report'
    case 'enhanced_dd': return 'Enhanced Due Diligence Report'
    case 'sanctions_alert': return 'Screening Summary Report'
    case 'periodic_review': return 'Periodic Review Report'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function screeningTableHtml(results: ScreeningResultData[]): string {
  if (results.length === 0) return '<p>No screening results available.</p>'

  const rows = results
    .map(
      (r) => `<tr>
        <td>${escapeHtml(r.type.replace('_', ' ').toUpperCase())}</td>
        <td><span class="badge badge-${r.status}">${escapeHtml(r.status)}</span></td>
        <td>${r.hit_count}</td>
        <td>${r.hit_count === 0 ? 'Clear' : r.hit_count >= 5 ? 'High' : r.hit_count >= 2 ? 'Medium' : 'Low'}</td>
      </tr>`
    )
    .join('')

  return `<table>
    <thead><tr><th>Type</th><th>Status</th><th>Hits</th><th>Severity</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

export function generateHTMLPreview(
  reportData: ReportData,
  template: ReportTemplate = 'standard_dd'
): string {
  const score = reportData.investigation.risk_score
  const rc = riskColor(score)
  const rl = riskLabel(score)

  const aiSection = reportData.aiAnalysis
    ? `
      <h2>4. Key Findings</h2>
      <ul>${reportData.aiAnalysis.keyFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>

      <h2>5. Risk Factors</h2>
      ${reportData.aiAnalysis.riskFactors
        .map(
          (rf) =>
            `<div class="risk-factor">
              <span class="rf-severity rf-${rf.severity}">${escapeHtml(rf.severity.toUpperCase())}</span>
              <strong>${escapeHtml(rf.category)}</strong>: ${escapeHtml(rf.description)}
              ${rf.evidence ? `<div class="rf-evidence">${escapeHtml(rf.evidence)}</div>` : ''}
            </div>`
        )
        .join('')}

      <h2>6. Recommended Actions</h2>
      <ol>${reportData.aiAnalysis.recommendedActions.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ol>
    `
    : ''

  const notesSection =
    reportData.analystNotes.length > 0
      ? `
        <h2>${reportData.aiAnalysis ? '7' : '4'}. Analyst Notes</h2>
        ${reportData.analystNotes
          .map(
            (n) =>
              `<div class="note">
                <p>${escapeHtml(n.content)}</p>
                <span class="note-meta">${escapeHtml(n.author_name ?? 'Analyst')} — ${formatDate(n.created_at)}</span>
              </div>`
          )
          .join('')}
      `
      : ''

  const timelineSection =
    reportData.timelineEvents.length > 0
      ? `
        <h2>Appendix: Timeline</h2>
        ${reportData.timelineEvents
          .map(
            (e) =>
              `<div class="timeline-entry">
                <strong>${escapeHtml(e.title)}</strong>
                ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ''}
                <span class="timeline-date">${formatDate(e.created_at)}</span>
              </div>`
          )
          .join('')}
      `
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(templateTitle(template))} — ${escapeHtml(reportData.entity.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0F172A; color: #E2E8F0; line-height: 1.6; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    .cover { text-align: center; padding: 60px 0; border-bottom: 2px solid #1E293B; margin-bottom: 40px; }
    .logo { font-size: 28px; font-weight: 800; color: #3B82F6; }
    .logo-sub { font-size: 12px; color: #64748B; margin-bottom: 40px; }
    .cover-title { font-size: 24px; font-weight: 700; color: #F8FAFC; margin-bottom: 8px; }
    .cover-entity { font-size: 18px; color: #94A3B8; margin-bottom: 30px; }
    .classification { display: inline-block; font-size: 11px; font-weight: 700; color: #EF4444; border: 1px solid #EF4444; padding: 6px 16px; letter-spacing: 2px; margin-bottom: 20px; }
    .cover-meta { font-size: 12px; color: #64748B; margin-bottom: 4px; }
    h2 { font-size: 16px; font-weight: 700; color: #F8FAFC; border-bottom: 1px solid #1E293B; padding-bottom: 6px; margin: 30px 0 14px; }
    p { color: #CBD5E1; margin-bottom: 10px; }
    ul, ol { padding-left: 20px; margin-bottom: 12px; }
    li { color: #CBD5E1; margin-bottom: 6px; }
    .risk-score { display: inline-flex; align-items: center; gap: 10px; padding: 12px 20px; border-radius: 8px; background: #1E293B; margin-bottom: 16px; }
    .risk-value { font-size: 28px; font-weight: 800; }
    .risk-label { font-size: 12px; font-weight: 600; letter-spacing: 1px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { text-align: left; font-size: 11px; font-weight: 600; color: #94A3B8; padding: 8px; border-bottom: 2px solid #334155; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px; border-bottom: 1px solid #1E293B; color: #CBD5E1; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-completed { background: #064E3B; color: #6EE7B7; }
    .badge-failed { background: #7F1D1D; color: #FCA5A5; }
    .badge-running { background: #1E3A5F; color: #93C5FD; }
    .badge-pending { background: #1E293B; color: #94A3B8; }
    .risk-factor { background: #1E293B; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
    .rf-severity { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; margin-right: 8px; }
    .rf-critical, .rf-high { background: #7F1D1D; color: #FCA5A5; }
    .rf-medium { background: #713F12; color: #FDE68A; }
    .rf-low { background: #064E3B; color: #6EE7B7; }
    .rf-evidence { font-size: 12px; color: #64748B; margin-top: 4px; }
    .note { background: #1E293B; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
    .note-meta { font-size: 11px; color: #64748B; }
    .timeline-entry { border-left: 2px solid #334155; padding-left: 16px; margin-bottom: 16px; }
    .timeline-date { font-size: 11px; color: #64748B; }
    .footer { text-align: center; font-size: 11px; color: #475569; border-top: 1px solid #1E293B; padding-top: 20px; margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="cover">
      <div class="logo">ThirdEye AI</div>
      <div class="logo-sub">Third-Party Due Diligence Platform</div>
      <div class="cover-title">${escapeHtml(templateTitle(template))}</div>
      <div class="cover-entity">${escapeHtml(reportData.entity.name)}</div>
      <div class="classification">CONFIDENTIAL</div>
      <div class="cover-meta">Date: ${formatDate(reportData.generatedAt)}</div>
      <div class="cover-meta">Generated by: ${escapeHtml(reportData.generatedBy)}</div>
    </div>

    <h2>1. Executive Summary</h2>
    ${
      reportData.aiAnalysis
        ? `<p>${escapeHtml(reportData.aiAnalysis.summary)}</p>`
        : `<p>This report presents the findings of a ${templateTitle(template).toLowerCase()} conducted on ${escapeHtml(reportData.entity.name)} (${escapeHtml(reportData.entity.type)}), jurisdicted in ${escapeHtml(reportData.entity.jurisdiction ?? 'an unspecified jurisdiction')}.</p>`
    }

    <h2>2. Risk Score Summary</h2>
    <div class="risk-score">
      <span class="risk-value" style="color: ${rc}">${score ?? 'N/A'}</span>
      <div>
        <div class="risk-label" style="color: ${rc}">${rl}</div>
        <div style="font-size: 11px; color: #64748B;">out of 100</div>
      </div>
    </div>

    <h2>3. Screening Results</h2>
    ${screeningTableHtml(reportData.screeningResults)}

    ${aiSection}
    ${notesSection}
    ${timelineSection}

    <div class="footer">Generated by ThirdEye AI · Confidential</div>
  </div>
</body>
</html>`
}
