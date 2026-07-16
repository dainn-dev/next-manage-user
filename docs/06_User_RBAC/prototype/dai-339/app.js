const roleConfig = {
  platform: {
    label: 'Platform shell', scope: 'Platform-wide', nav: ['Overview', 'Tenants', 'Billing', 'Admins', 'Audit'],
    journeys: [{ name: 'Tenant lifecycle control', steps: [
      ['Platform overview', 'Review tenant health and exceptions.', 'Open tenants'],
      ['Tenant directory', 'Find the authorized tenant without entering tenant operations.', 'Open tenant detail'],
      ['Tenant detail', 'Review identity, subscription, plan limits and lifecycle.', 'Suspend tenant'],
      ['Confirm suspension', 'Confirm target, impact and required reason.', 'Confirm suspension'],
      ['Audit outcome', 'Show durable outcome and audit reference; never impersonate the tenant.', 'Finish review']
    ] }]
  },
  tenant: {
    label: 'Tenant Operations', scope: 'Site Nguyễn Văn Linh', nav: ['Tổng quan', 'Sự kiện', 'Sơ đồ bãi', 'Camera', 'Phương tiện', 'Quản trị'],
    journeys: [
      { name: 'Access request decision', steps: [
        ['Tổng quan site', 'Pending work is shown before supporting KPIs.', 'Open pending requests'],
        ['Yêu cầu ra/vào', 'Filter to the selected site and inspect authoritative request state.', 'Review request'],
        ['Request detail', 'Review vehicle, member, site, evidence and policy.', 'Approve request'],
        ['Confirm approval', 'Name the request, selected site and material effect.', 'Confirm approval'],
        ['Decision outcome', 'Show new state, audit reference and correlation ID.', 'Finish review']
      ]},
      { name: 'Publish parking map', steps: [
        ['Commissioning readiness', 'Check Overview camera, source, calibration and draft.', 'Open draft'],
        ['Draft editor', 'Edit polygons; autosave does not affect runtime.', 'Validate map'],
        ['Validation summary', 'Resolve site-wide slot and camera-partition issues.', 'Review publish'],
        ['Publish confirmation', 'Review version diff, archived version and runtime impact.', 'Publish version'],
        ['Published outcome', 'Show active version and audit reference.', 'Open runtime map']
      ]}
    ]
  },
  manager: {
    label: 'Tenant Operations', scope: 'Assigned · Site Thủ Đức', nav: ['Tổng quan', 'Sự kiện', 'Sơ đồ bãi', 'Camera', 'Phương tiện', 'Thống kê'],
    journeys: [{ name: 'Exception escalation', steps: [
      ['Assigned-site dashboard', 'Only active assigned sites appear in scope.', 'Open unresolved events'],
      ['Unresolved events', 'Inspect evidence and freshness without tenant-wide data.', 'Open event'],
      ['Event detail', 'Review severity, gate, camera, current state and history.', 'Escalate'],
      ['Escalation confirmation', 'Enter reason and verify recipient and selected site.', 'Send escalation'],
      ['Escalation outcome', 'Show durable status, audit and correlation reference.', 'Return to events']
    ] }]
  },
  guard: {
    label: 'Guard kiosk', scope: 'Locked · Gate Bắc', nav: ['Live', 'Sự kiện', 'Handover'],
    journeys: [{ name: 'Verify and allow once', steps: [
      ['Shift confirmation', 'Confirm assigned site, exact gate and active shift.', 'Start shift'],
      ['Live monitoring', 'Large, truthful connectivity and event state for tablet use.', 'Open exception'],
      ['Exception evidence', 'Compare plate, snapshot, policy and same-site history.', 'Verify event'],
      ['Allow once confirmation', 'Acknowledge evidence and enter a required reason.', 'Allow once'],
      ['Command outcome', 'Show event result, gate command state, audit and correlation.', 'Return to live']
    ] }]
  },
  member: {
    label: 'Member self-service', scope: 'Cá nhân', nav: ['Xe', 'Đăng ký', 'Visit/QR', 'Lịch sử', 'Tài khoản'],
    journeys: [
      { name: 'Vehicle registration request', steps: [
        ['Xe của tôi', 'Show self-owned vehicles only.', 'Choose vehicle'],
        ['Choose organization', 'Discover eligible organization and site without leaking private tenants.', 'Continue'],
        ['Registration form', 'Enter request fields and attach required evidence.', 'Submit request'],
        ['Submission pending', 'Show pending state without implying approval.', 'View request'],
        ['Request status', 'Show lifecycle, public reason and next eligible action.', 'Return to garage']
      ]},
      { name: 'Claim and present visit QR', steps: [
        ['Visit / QR', 'List self-owned and claimed visits.', 'Claim visit'],
        ['Claim confirmation', 'Validate token scope and expiry before linking.', 'Confirm claim'],
        ['Visit detail', 'Show site, validity window and claim state.', 'Show QR'],
        ['QR presentation', 'Use a time-bound token with offline expiry behavior.', 'Refresh status'],
        ['Visit outcome', 'Show admitted, expired or unavailable truthfully.', 'Open history']
      ]}
    ]
  }
};

const ui = Object.fromEntries(['role-picker','journey-picker','step-list','state-picker','shell-label','screen-title','scope-chip','app-navigation','screen-state','screen-content','back-step','primary-action','member-bottom-nav','prototype-status','review-dialog','change-request','change-request-list'].map(id => [id.replaceAll('-', '_'), document.getElementById(id)]));
let currentRole = 'platform';
let currentJourney = 0;
let currentStep = 0;
let apiState = 'success';

function badge(text, tone = 'positive') { return `<span class="badge badge-${tone}">${text}</span>`; }
function sampleContent(title, description, step) {
  const final = step === currentJourneyData().steps.length - 1;
  const tone = /confirm|suspend|allow|approval|publish/i.test(title) ? 'warning' : final ? 'positive' : 'positive';
  const metrics = currentRole === 'member'
    ? [['Trạng thái', final ? 'Đã cập nhật' : 'Sẵn sàng'], ['Phạm vi', 'Tài khoản của tôi'], ['Cập nhật', 'Vừa xong']]
    : currentRole === 'guard'
      ? [['Kết nối', 'Live'], ['Gate', 'Gate Bắc'], ['Sự kiện', final ? 'Đã xử lý' : '1 cần xử lý']]
      : [['Phạm vi', roleConfig[currentRole].scope], ['Pending', final ? '0' : '3'], ['Cập nhật', '14:32:08']];
  return `<div class="hero"><div>${badge(final ? 'Outcome' : `Step ${step + 1}`, tone)}</div><h3>${title}</h3><p>${description}</p></div>
    <div class="metric-grid">${metrics.map(([k,v]) => `<div class="metric"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
    <div class="detail-grid">
      <div class="card"><p class="eyebrow">Authoritative context</p><div class="card-list">
        <div class="card-row"><div><strong>Selected resource</strong><p>${roleConfig[currentRole].scope}</p></div>${badge('Authorized')}</div>
        <div class="card-row"><div><strong>Server state</strong><p>Version 7 · correlation pv-24f8</p></div>${badge(final ? 'Completed' : 'Current', final ? 'positive' : 'warning')}</div>
      </div></div>
      <div class="card"><p class="eyebrow">Action context</p><div class="field-stack">
        <label class="field"><span>Reason / note</span><textarea rows="3" placeholder="Bắt buộc cho hành động có rủi ro"></textarea></label>
        <div class="field"><span>Audit feedback</span><strong>${final ? 'AUD-2026-0716-0042' : 'Created only after server success'}</strong></div>
      </div></div>
    </div>`;
}

function currentJourneyData() { return roleConfig[currentRole].journeys[currentJourney]; }
function renderJourneyOptions() {
  ui.journey_picker.innerHTML = roleConfig[currentRole].journeys.map((journey, i) => `<option value="${i}">${journey.name}</option>`).join('');
  ui.journey_picker.value = String(currentJourney);
}
function renderSteps() {
  ui.step_list.innerHTML = currentJourneyData().steps.map((step, i) => `<li><button type="button" data-step="${i}" ${i === currentStep ? 'aria-current="step"' : ''}><span class="step-number">${i + 1}</span><span>${step[0]}</span></button></li>`).join('');
}
function renderNavigation() {
  const config = roleConfig[currentRole];
  ui.app_navigation.innerHTML = config.nav.map((item, i) => `<a href="#" ${i === Math.min(currentStep, config.nav.length - 1) ? 'aria-current="page"' : ''}>${item}</a>`).join('');
  ui.member_bottom_nav.innerHTML = config.nav.map((item, i) => `<a href="#" ${i === Math.min(currentStep, config.nav.length - 1) ? 'aria-current="page"' : ''}>${item}</a>`).join('');
}
function renderState() {
  const stateCopy = {
    success: ['success', 'Dữ liệu hiện tại đã được tải và xác thực theo scope.'],
    pending: ['pending', 'Đang gửi yêu cầu… Giữ nguyên trạng thái server trước đó và khóa gửi lặp.'],
    failure: ['failure', 'Yêu cầu thất bại. Không có thay đổi nào được xác nhận; kiểm tra và thử lại.']
  };
  const [tone, copy] = stateCopy[apiState];
  ui.screen_state.className = `state-banner visible ${tone}`;
  ui.screen_state.textContent = copy;
}
function render() {
  const config = roleConfig[currentRole];
  const [title, description, action] = currentJourneyData().steps[currentStep];
  ui.shell_label.textContent = config.label;
  ui.screen_title.textContent = title;
  ui.scope_chip.textContent = config.scope;
  ui.screen_content.innerHTML = sampleContent(title, description, currentStep);
  ui.primary_action.textContent = apiState === 'pending' ? 'Đang xử lý…' : action;
  ui.primary_action.disabled = apiState === 'pending';
  ui.back_step.disabled = currentStep === 0;
  document.querySelector('.app-frame').classList.toggle('member-mode', currentRole === 'member');
  renderSteps(); renderNavigation(); renderState();
}
function setRole(role) {
  currentRole = role; currentJourney = 0; currentStep = 0; apiState = 'success';
  renderJourneyOptions(); syncStateButtons(); render();
}
function syncStateButtons() {
  ui.state_picker.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.state === apiState)));
}

ui.role_picker.addEventListener('change', event => setRole(event.target.value));
ui.journey_picker.addEventListener('change', event => { currentJourney = Number(event.target.value); currentStep = 0; render(); });
ui.step_list.addEventListener('click', event => { const button = event.target.closest('[data-step]'); if (button) { currentStep = Number(button.dataset.step); render(); } });
ui.state_picker.addEventListener('click', event => { const button = event.target.closest('[data-state]'); if (button) { apiState = button.dataset.state; syncStateButtons(); render(); } });
ui.primary_action.addEventListener('click', () => { if (currentStep < currentJourneyData().steps.length - 1) currentStep += 1; render(); });
ui.back_step.addEventListener('click', () => { if (currentStep > 0) currentStep -= 1; render(); });
document.getElementById('mobile-menu').addEventListener('click', () => ui.app_navigation.classList.toggle('open'));
document.getElementById('review-toggle').addEventListener('click', () => ui.review_dialog.showModal());
document.getElementById('approve-prototype').addEventListener('click', () => {
  localStorage.setItem('dai339-review-status', 'approved');
  ui.prototype_status.textContent = 'Approved locally';
});
document.getElementById('save-change-request').addEventListener('click', event => {
  event.preventDefault();
  const value = ui.change_request.value.trim();
  if (!value) return;
  const requests = JSON.parse(localStorage.getItem('dai339-change-requests') || '[]');
  requests.push({ text: value, createdAt: new Date().toISOString() });
  localStorage.setItem('dai339-change-requests', JSON.stringify(requests));
  localStorage.setItem('dai339-review-status', 'changes-requested');
  ui.change_request.value = '';
  renderReview();
});
function renderReview() {
  const status = localStorage.getItem('dai339-review-status');
  ui.prototype_status.textContent = status === 'approved' ? 'Approved locally' : status === 'changes-requested' ? 'Changes requested' : 'Chưa review';
  const requests = JSON.parse(localStorage.getItem('dai339-change-requests') || '[]');
  ui.change_request_list.innerHTML = requests.map(item => `<li>${item.text} <small>(${new Date(item.createdAt).toLocaleString('vi-VN')})</small></li>`).join('');
}

renderJourneyOptions(); renderReview(); render();
