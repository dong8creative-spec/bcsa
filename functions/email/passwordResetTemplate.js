/**
 * 비밀번호 재설정 안내 메일 HTML (한국어)
 * @param {{ resetLink: string, email: string, appName?: string }} params
 */
export function buildPasswordResetEmailHtml({ resetLink, email, appName = '부산청년사업가들' }) {
  const safeEmail = String(email || '').replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>비밀번호 재설정</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);padding:28px 32px;text-align:center;">
              <div style="width:48px;height:48px;margin:0 auto 12px;background:rgba(255,255,255,0.18);border-radius:14px;line-height:48px;font-size:22px;">🔐</div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">비밀번호 재설정</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.88);font-size:13px;">${appName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">안녕하세요.</p>
              <p style="margin:0 0 20px;color:#334155;font-size:15px;line-height:1.7;">
                <strong style="color:#0f172a;">${safeEmail}</strong> 계정의 비밀번호 재설정을 요청하셨습니다.<br />
                아래 버튼을 눌러 새 비밀번호를 설정해 주세요.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);">
                    <a href="${resetLink}" target="_blank" rel="noopener noreferrer"
                      style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:-0.01em;">
                      비밀번호 재설정하기
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;color:#64748b;font-size:13px;line-height:1.6;">
                버튼이 동작하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요.
              </p>
              <p style="margin:0 0 24px;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;word-break:break-all;font-size:12px;line-height:1.6;color:#475569;">
                <a href="${resetLink}" style="color:#2563eb;text-decoration:none;">${resetLink}</a>
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;color:#9a3412;font-size:12px;line-height:1.6;">
                      본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.<br />
                      링크는 보안을 위해 일정 시간 후 만료됩니다.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                © ${new Date().getFullYear()} ${appName} (BCSA)<br />
                본 메일은 발신 전용입니다.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPasswordResetEmailText({ resetLink, email, appName = '부산청년사업가들' }) {
  return `[${appName}] 비밀번호 재설정 안내

안녕하세요.
${email} 계정의 비밀번호 재설정을 요청하셨습니다.

아래 링크에서 새 비밀번호를 설정해 주세요.
${resetLink}

본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.
링크는 보안을 위해 일정 시간 후 만료됩니다.`;
}
