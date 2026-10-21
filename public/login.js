const form = document.getElementById('auth-form');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const msgEl = document.getElementById('auth-msg');

// Chỉ cho phép quay về các trang trong cùng website
function safeNext() {
  const next = new URLSearchParams(location.search).get('next') || '/tai-khoan';
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : '/tai-khoan';
}

function showMsg(text, ok = false) {
  msgEl.textContent = text;
  msgEl.className = 'auth-msg' + (text ? (ok ? ' ok' : ' err') : '');
}

function translateError(message) {
  if (/invalid login credentials/i.test(message)) return 'Sai email hoặc mật khẩu.';
  if (/already registered/i.test(message)) return 'Email này đã được đăng ký.';
  if (/at least 6/i.test(message)) return 'Mật khẩu phải có ít nhất 6 ký tự.';
  if (/email not confirmed/i.test(message)) return 'Bạn cần bấm link xác nhận trong email trước.';
  if (/rate limit/i.test(message)) return 'Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.';
  return message;
}

function setBusy(busy) {
  loginBtn.disabled = busy;
  signupBtn.disabled = busy;
}

async function requireClient() {
  const sb = await getSb();
  if (!sb) {
    showMsg('Không tải được chức năng đăng nhập. Hãy tải lại trang.');
    return null;
  }
  return sb;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg('');
  if (!form.reportValidity()) return;

  setBusy(true);
  try {
    const sb = await requireClient();
    if (!sb) return;
    const { error } = await sb.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passwordEl.value
    });
    if (error) return showMsg(translateError(error.message));
    location.href = safeNext();
  } catch (err) {
    console.error(err);
    showMsg('Không kết nối được máy chủ. Hãy thử lại.');
  } finally {
    setBusy(false);
  }
});

signupBtn.addEventListener('click', async () => {
  showMsg('');
  if (!form.reportValidity()) return;

  setBusy(true);
  try {
    const sb = await requireClient();
    if (!sb) return;
    const { data, error } = await sb.auth.signUp({
      email: emailEl.value.trim(),
      password: passwordEl.value
    });
    if (error) return showMsg(translateError(error.message));
    if (data.session) {
      location.href = safeNext();
    } else {
      showMsg('Đã gửi email xác nhận. Hãy bấm link trong email rồi quay lại đăng nhập.', true);
    }
  } catch (err) {
    console.error(err);
    showMsg('Không kết nối được máy chủ. Hãy thử lại.');
  } finally {
    setBusy(false);
  }
});

// Đã đăng nhập thì chuyển đi luôn
(async () => {
  const session = await getSession();
  if (session) location.replace(safeNext());
})();