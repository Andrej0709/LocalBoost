/* Invites from testers: the invite card in the control room hands out the
 * link, invite.html is where it lands, signup.html keeps the code on the new
 * account (referred_by), and the portal shows who brought whom.
 *
 * What each side gets for an invite is set here and nowhere else. null means
 * no perk is promised anywhere; to promise one, give both languages, e.g.
 *   referrer: { en: "A free month after the launch for every business you
 *                    bring into the beta.",
 *               sr: "Mesec besplatno posle lansiranja za svaki lokal koji
 *                    dovedeš u betu." }
 */
(function () {
  var PERKS = {
    referrer: null,   // what the tester who invites gets
    friend: null      // what the invited business gets
  };

  window.LBReferral = {
    perk: function (side) {
      var p = PERKS[side];
      if (!p) return null;
      return window.LBLang && LBLang.get() === "sr" ? p.sr : p.en;
    },
    // A tester's code is the first 8 characters of their account id
    // (referrer_name and my_referrals in schema.sql); /u/ is a redirect in
    // vercel.json.
    link: function (userId) {
      return location.origin + "/u/" + String(userId).slice(0, 8);
    }
  };
})();
