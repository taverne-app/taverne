<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur La Taverne</title>
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
    .features { background: #1c1917; border-radius: 10px; padding: 20px 24px; margin: 24px 0; }
    .features p { margin: 0 0 8px; font-size: 14px; }
    .features p:last-child { margin: 0; }
    .check { color: #f59e0b; margin-right: 8px; }
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
      <h1>Bienvenue, {{ $user->name }} !</h1>
      <p>Votre compte est prêt. Vous pouvez dès maintenant créer votre première campagne et commencer à préparer vos sessions.</p>
      <a href="{{ env('FRONTEND_URL', 'https://taverne.app') }}/campaigns" class="btn">Accéder à La Taverne</a>
      <div class="features">
        <p><span class="check">✦</span>Gérez vos PNJ, lieux, factions et quêtes</p>
        <p><span class="check">✦</span>Tracker de combat en temps réel</p>
        <p><span class="check">✦</span>Page partagée pour vos joueurs</p>
        <p><span class="check">✦</span>Préparation de sessions structurée</p>
      </div>
      <p>Votre plan gratuit inclut 1 campagne et jusqu'à 4 joueurs. Passez au plan Aventurier (5€/mois) pour des campagnes illimitées.</p>
      <p style="color: #78716c; font-size: 13px;">Des questions ? Répondez directement à cet email.</p>
    </div>
    <div class="footer">
      <p>© {{ date('Y') }} La Taverne — Outil de gestion de campagnes D&D 5e</p>
    </div>
  </div>
</body>
</html>
