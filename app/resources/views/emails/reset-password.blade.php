<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de mot de passe — La Taverne</title>
  <style>
    body { margin: 0; padding: 0; background: #1c1917; font-family: Georgia, serif; color: #e7e5e4; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #292524; border-radius: 16px; overflow: hidden; }
    .header { background: #1c1917; padding: 32px; text-align: center; border-bottom: 1px solid #44403c; }
    .logo { color: #f59e0b; font-size: 22px; font-weight: bold; letter-spacing: -0.5px; }
    .body { padding: 36px 32px; }
    h1 { color: #fff; font-size: 20px; margin: 0 0 16px; }
    p { color: #a8a29e; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: #f59e0b; color: #1c1917; font-weight: bold; font-size: 15px;
           text-decoration: none; padding: 12px 28px; border-radius: 10px; margin: 8px 0 24px; }
    .notice { background: #1c1917; border-radius: 10px; padding: 16px 20px; margin: 16px 0; }
    .notice p { font-size: 13px; color: #78716c; margin: 0; }
    .footer { text-align: center; padding: 20px 32px; border-top: 1px solid #44403c; }
    .footer p { color: #57534e; font-size: 13px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">La Taverne</div>
    </div>
    <div class="body">
      <h1>Réinitialisation de mot de passe</h1>
      <p>Vous avez demandé à réinitialiser le mot de passe de votre compte La Taverne. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>
      <a href="{{ $url }}" class="btn">Réinitialiser mon mot de passe</a>
      <div class="notice">
        <p>Ce lien est valable 60 minutes. Après expiration, vous devrez faire une nouvelle demande.</p>
        <p style="margin-top: 8px;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe restera inchangé.</p>
      </div>
      <p style="color: #78716c; font-size: 13px; word-break: break-all;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : {{ $url }}</p>
    </div>
    <div class="footer">
      <p>© {{ date('Y') }} La Taverne — Outil de gestion de campagnes D&D 5e</p>
    </div>
  </div>
</body>
</html>
