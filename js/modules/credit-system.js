// Extracted PayPal SDK loading logic and /api/credits/sync fetch calls from billing.js
const API_BASE_URL = '';
window.API_BASE_URL = API_BASE_URL;

// Global credit counter
let globalCredits = 0;
let globalPlan = 'free';

// Function to handle requests with rate limiting and prompt protection
export async function loadPayPalSDK() {
  if (typeof window.paypal !== 'undefined') return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/config`);
    const data = await response.json();
    const paypalId = data.paypal_id || 'sb';

    const script = document.createElement('script');
    // Use sandbox domain for sandbox client IDs (sb or IDs starting with AZD/Ab- for sandbox)
    const isSandbox = paypalId === 'sb' || paypalId.startsWith('AZD') || paypalId.startsWith('Ab');
    const sdkDomain = isSandbox ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';
    script.src = `${sdkDomain}/sdk/js?client-id=${paypalId}&components=buttons&currency=USD&intent=capture&buyer-country=US`;
    script.setAttribute('data-namespace', 'paypal');
    script.onload = () => console.log('PayPal SDK loaded:', paypalId, isSandbox ? '(sandbox)' : '');
    script.onerror = () => console.error('Failed to load PayPal SDK');
    document.head.appendChild(script);
  } catch (error) {
    console.error('Failed to fetch PayPal ID:', error);
    const script = document.createElement('script');
    script.src = 'https://www.sandbox.paypal.com/sdk/js?client-id=sb&components=buttons&currency=USD&intent=capture&buyer-country=US';
    script.setAttribute('data-namespace', 'paypal');
    script.onload = () => console.log('PayPal SDK loaded (sandbox fallback)');
    script.onerror = () => console.error('Failed to load PayPal SDK');
    document.head.appendChild(script);
  }
}

// Function to sync credits from /api/credits/status
export async function syncCredits() {
  const channelId = localStorage.getItem('ytseo_channel_id');
  if (!channelId || !/^UC[\w-]{22}$/.test(channelId)) {
    globalCredits = 0;
    globalPlan = 'free';
    updateGlobalCreditDisplay();
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/credits/status?channelId=${encodeURIComponent(channelId)}`);
    if (!res.ok) throw new Error('Failed to fetch status');
    const data = await res.json();
    globalCredits = data.credits;
    globalPlan = data.plan;
    localStorage.setItem('ytseo_user_credits', data.credits);
    localStorage.setItem('userPlan', data.plan);
    window.isPremium = ['pro', 'agency'].includes(data.plan);
    if (typeof window.updatePremiumUI === 'function') window.updatePremiumUI();
    updateGlobalCreditDisplay();
  } catch (e) {
    console.error('[Credit] Sync failed:', e);
    globalCredits = parseInt(localStorage.getItem('ytseo_user_credits') || '0');
    globalPlan = localStorage.getItem('userPlan') || 'free';
  }
}

// Function to initialize PayPal button with SDK loading check and nonce security
let isPayPalInitializing = false;
let currentPayPalRender = null;

export async function initializePayPalButton(plan, amount) {
  if (isPayPalInitializing) return;
  isPayPalInitializing = true;

  const container = document.getElementById('paypal-button-container');
  if (!container) {
    console.error('[Upgrade] PayPal container not found');
    isPayPalInitializing = false;
    return;
  }

  // State-aware: if buttons already exist for this plan, don't re-render
  if (container.hasChildNodes() && container.dataset.plan === plan) {
    console.log('[PayPal] Buttons already rendered for plan:', plan);
    isPayPalInitializing = false;
    return;
  }

  // Fresh start ONLY if plan changed or container is empty
  container.innerHTML = '';
  container.dataset.plan = plan;

  // Show loading state
  container.innerHTML = '<div style="text-align: center; padding: 20px;"><div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #f97316; border-radius: 50%; border-top-color: transparent; animation: spin 1s ease-in-out infinite;"></div><p style="color: var(--text-muted); margin-top: 10px;">Loading PayPal...</p></div><style>@keyframes spin { to { transform: rotate(360deg); } }</style>';

  const cleanAmount = parseFloat(amount || 0).toFixed(2);
  console.log(`[Upgrade] Initializing PayPal for ${plan} at $${cleanAmount}`);

  try {
    // Wait for PayPal SDK to be ready with timeout
    let attempts = 0;
    while (!window.paypal && attempts < 50) { // 5 seconds max
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.paypal) {
      console.error('[Upgrade] PayPal SDK failed to load after 5 seconds');
      container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);"><i data-lucide="alert-triangle" style="color: #ef4444;"></i><p>PayPal loading failed. Please refresh and try again.</p></div>';
      isPayPalInitializing = false;
      return;
    }

    currentPayPalRender = window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
      createOrder: async (data, actions) => {
        try {
          const channelId = localStorage.getItem('ytseo_channel_id');
          const accessToken = localStorage.getItem('ytseo_access_token');
          
          const res = await fetch(API_BASE_URL + '/api/credits/nonce', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-channel-id': channelId || 'anonymous',
              'x-access-token': accessToken || '',
              'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || ''
            },
            body: JSON.stringify({ plan, channelId: channelId || 'anonymous' })
          });
          
          const nonceData = await res.json();
          if (nonceData.error) throw new Error(nonceData.error);
          
          // Store nonce for onApprove verification
          localStorage.setItem('paypal_nonce', nonceData.nonce);
          
          // Create the actual PayPal order
          return actions.order.create({
            purchase_units: [{
              description: `${plan.toUpperCase()} Plan - YT SEO Architect`,
              amount: {
                currency_code: 'USD',
                value: cleanAmount
              },
              custom_id: channelId || 'anonymous'
            }]
          });
        } catch (err) {
          console.error('[PayPal] Order creation failed:', err);
          throw err;
        }
      },
      onApprove: async (data, actions) => {
        try {
          // Skip client-side capture (sandbox issues) — server will capture
          const res = await fetch(API_BASE_URL + '/api/credits/purchase-success', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-csrf-token': window.csrfToken || localStorage.getItem('csrf_token') || '',
              'x-channel-id': localStorage.getItem('ytseo_channel_id') || 'anonymous'
            },
            body: JSON.stringify({
              orderID: data.orderID,
              plan: plan,
              channelId: localStorage.getItem('ytseo_channel_id') || 'anonymous',
              nonce: localStorage.getItem('paypal_nonce') || ''
            })
          });
          const result = await res.json();
          if (result.success) {
            await syncCredits();
            localStorage.removeItem('paypal_nonce');
            if (typeof window.showToast === 'function') window.showToast(plan + ' activated! ' + result.credits + ' credits added.', 'success');
          } else {
            throw new Error(result.error || 'Capture failed');
          }
        } catch (err) {
          console.error('[PayPal] Capture error:', err.message);
          // Distinguish sandbox auth issues from real failures
          if (err.message && err.message.includes('Buyer access token')) {
            if (typeof window.showToast === 'function') {
              window.showToast('Sandbox: Please log into your PayPal sandbox buyer account and try again. Go to sandbox.paypal.com to create test accounts.', 'warning');
            }
          } else {
            if (typeof window.showToast === 'function') window.showToast('Payment verification failed. Contact support.', 'error');
          }
        }
      },
      onCancel: () => {
        console.log('[PayPal] Payment cancelled');
      },
      onError: (err) => {
        console.error('[PayPal] SDK Error:', err.message);
        if (err.message && err.message.includes('Buyer access token')) {
          if (typeof window.showToast === 'function') {
            window.showToast('Sandbox: Log into sandbox.paypal.com with test buyer account first.', 'warning');
          }
        }
      }
    });

    // Clear loading state before rendering PayPal buttons
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Visual Heartbeat & Width Guard
    const containerEl = document.getElementById('paypal-button-container');
    const w = containerEl.offsetWidth;
    const h = containerEl.offsetHeight;
    console.log(`[Upgrade] Container Geometry: ${w}x${h}px (Client: ${containerEl.clientWidth}x${containerEl.clientHeight}px)`);
    
    if (w < 100 || h < 50) {
      console.warn('[Upgrade] Container too small! Forcing 100%x150px geometry...');
      containerEl.style.cssText += 'min-height: 150px !important; width: 100% !important; display: block !important;';
    }

    // Force a visual border for debugging
    containerEl.style.border = '2px dashed #f97316';
    containerEl.style.background = 'rgba(249, 115, 22, 0.05)';
    containerEl.style.backgroundColor = 'yellow'; // Debug background

    await currentPayPalRender.render('#paypal-button-container');

    // POST-RENDER AUDIT
    setTimeout(() => {
      const iframes = containerEl.getElementsByTagName('iframe');
      console.log(`[Upgrade] Post-Render Audit: Found ${iframes.length} iframes. Container height is ${containerEl.offsetHeight}px.`);
      
      if (iframes.length === 0) {
        console.error('[Upgrade] CRITICAL: No iframe found in container after render success!');
      } else {
        const frame = iframes[0];
        console.log('[Upgrade] Iframe Source:', frame.src.substring(0, 100) + '...');
        // Force iframe visibility and block display
        frame.style.cssText += 'display: block !important; visibility: visible !important; opacity: 1 !important; min-height: 150px !important; width: 100% !important; z-index: 2147483648 !important;';
        console.log('[Upgrade] PayPal buttons rendered and visibility forced.');
      }
    }, 1000);

    // Check modal visibility
    const modal = document.getElementById('payment-modal');
    if (modal) {
      modal.style.zIndex = '9999999'; 
      const style = window.getComputedStyle(modal);
      console.log(`[Upgrade] Modal Final Check: Display=${style.display}, Visibility=${style.visibility}, Opacity=${style.opacity}, ZIndex=${style.zIndex}`);
    }

  } catch (err) {
    console.error('[Upgrade] PayPal initialization error:', err);
    container.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-muted);">
        <p>Failed to load payment options.</p>
        <button onclick="window.location.reload()" style="background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">Reload Page</button>
      </div>
    `;
  } finally {
    isPayPalInitializing = false;
  }
}

// Function to update global credit display
function updateGlobalCreditDisplay() {
  if (window.CreditsSystem && typeof window.CreditsSystem.sync === 'function') {
    return window.CreditsSystem.sync();
  }
  
  const el = document.getElementById('bento-credits-value');
  const countEl = document.getElementById('credits-count');
  const totalEl = document.getElementById('credits-total');
  const val = globalCredits;

  if (el) el.textContent = val;
  if (countEl) countEl.textContent = val;
  // Update total display based on plan
  if (totalEl) {
    if (globalPlan === 'agency') totalEl.textContent = '∞';
    else if (globalPlan === 'pro') totalEl.textContent = '1,000';
    else totalEl.textContent = '100';
  }

  // Sync the internal CreditsSystem state with server value
  if (window.CreditsSystem && typeof window.CreditsSystem.total !== 'undefined') {
    window.CreditsSystem.total = val;
    window.CreditsSystem.used = 0;
    if (typeof window.CreditsSystem.save === 'function') {
      window.CreditsSystem.save();
    }
  }

  const globalCreditsElements = document.querySelectorAll('.user-credits-count');
  globalCreditsElements.forEach(span => span.textContent = val);
}

// PayPal modal functions
const PLAN_CONFIG = {
  pro: { name: 'Pro', price: '5', credits: '1,000 Credits/month', amount: '5.00' },
  agency: { name: 'Agency', price: '19', credits: 'Unlimited', amount: '19.00' }
};

export async function openUpgradeModal(plan, amount) {
  console.log('[Upgrade] Opening modal for plan:', plan, 'amount:', amount);
  console.log('[Upgrade] Modal element found:', !!document.getElementById('payment-modal'));

  // Normalize plan name
  let normalizedPlan = 'pro';
  if (typeof plan === 'string') {
    const p = plan.toLowerCase();
    if (p.includes('agency')) normalizedPlan = 'agency';
    else normalizedPlan = 'pro';
  }

  // Pricing lookup table
  const pricing = { 'pro': 5, 'agency': 19 };
  const cleanAmount = amount || pricing[normalizedPlan] || 29;
  
  console.log('[Upgrade] Using final amount:', cleanAmount, 'for normalized plan:', normalizedPlan);

  // Check PayPal SDK loaded
  if (typeof window.paypal === 'undefined') {
    alert('Payment system loading... please wait 2 seconds');
    console.warn('[PayPal] SDK not loaded yet');
    return;
  }

  const config = PLAN_CONFIG[normalizedPlan] || PLAN_CONFIG.pro;
  const modal = document.getElementById('payment-modal');
  if (!modal) { console.error('[Upgrade] Modal not found'); return; }

  const titleEl = document.getElementById('payment-modal-title');
  const descEl = document.getElementById('payment-modal-desc');
  if (titleEl) titleEl.textContent = 'Upgrade to ' + (config.name || normalizedPlan);
  if (descEl) descEl.textContent = config.name + ' - $' + config.price + ' (' + config.credits + ')';

  // Open modal FIRST - use hidden class approach
  modal.classList.remove('hidden');
  modal.style.zIndex = '2147483647';
  console.log('[Upgrade] Hidden class removed, modal classes:', modal.className);

  // Wait 300ms for browser to reflow the modal and animation to finish
  // This ensures the container has stable dimensions for PayPal SDK
  await new Promise(r => setTimeout(r, 300));

  return initializePayPalButton(normalizedPlan, cleanAmount);
}

export function closeBuyCreditsModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}