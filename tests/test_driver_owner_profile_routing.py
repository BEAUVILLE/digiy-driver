"""DIGIY DRIVER · owner profile routing tests (Lamine vs another chauffeur).

Never connects to real Supabase or creates a booking.
"""
import re
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ACCESS=(ROOT/"acces-proprietaire.html").read_text(encoding="utf-8")
GESTION=(ROOT/"gestion.html").read_text(encoding="utf-8")
FICHE=(ROOT/"chauffeur.html").read_text(encoding="utf-8")


class DriverOwnerRouting(unittest.TestCase):
    def test_access_does_not_fall_back_to_wrong_driver(self):
        self.assertIn("const requestedSlug=(p.get('slug')||'').trim();",ACCESS)
        self.assertIn("if(requestedSlug && !chosen)",ACCESS)
        self.assertIn("if(requestedSlug && !validSlug(requestedSlug))",ACCESS)
        self.assertIn("rows.find(r=>r.slug===requestedSlug)",ACCESS)
        self.assertIn("if(!chosen && rows.length===1) chosen=rows[0]",ACCESS)
        self.assertNotIn("chosen=rows.find(r=>r.slug===saved)||rows[0]",ACCESS)
        self.assertIn("rows.find(r=>r.slug===saved)||null",ACCESS)
        self.assertIn("eq('owner_id',session.user.id).eq('is_active',true)",ACCESS)
        self.assertIn("shouldCreateUser:false",ACCESS)
        self.assertIn("emailRedirectTo:redirect()",ACCESS)
        self.assertIn("localStorage.setItem('digiy_driver_owner_slug',chosen.slug)",ACCESS)
        # A stale/forged slug must not be saved ahead of ownership validation.
        self.assertNotIn("if(requestedSlug) localStorage.setItem(",ACCESS)

    def test_management_requires_explicit_active_owner_slug(self):
        self.assertNotIn("||'baptiste-driver-ambassador'",GESTION)
        self.assertIn("slug=(params.get('slug')||'').trim()",GESTION)
        self.assertIn("if(!validSlug) return msg('pageStatus'",GESTION)
        self.assertIn(".eq('slug',slug).eq('owner_id',session.user.id).eq('is_active',true).maybeSingle()",GESTION)
        self.assertIn("if(!session)return location.replace",GESTION)
        self.assertIn("digiy_driver_master_set_profile_v1",GESTION)
        self.assertIn("digiy_driver_master_set_contact_v1",GESTION)
        self.assertIn("digiy_driver_master_set_presence_v1",GESTION)

    def test_public_driver_fiche_passes_slug_to_owner_access(self):
        self.assertIn('id="btnOwner" href="./acces-proprietaire.html"',FICHE)
        self.assertIn('getElementById("btnOwner").href = withDriverLang(digiyLocal("acces-proprietaire.html")',FICHE)
        self.assertIn("encodeURIComponent(slugForRpc)",FICHE)
        self.assertIn("if(!slugForRpc)",FICHE)
        self.assertIn('name="robots" content="noindex,nofollow,noarchive"',ACCESS)
        self.assertIn('name="robots" content="noindex,nofollow,noarchive"',GESTION)

    def test_javascript_syntax_unchanged(self):
        for name,html in (("access",ACCESS),("gestion",GESTION)):
            scripts=re.findall(r"<script\b([^>]*)>([\s\S]*?)</script>",html)
            for attrs,source in scripts:
                if "src=" in attrs or not source.strip(): continue
                result=subprocess.run(["node","--check","-"],input=source,text=True,capture_output=True)
                self.assertEqual(result.returncode,0,name+": "+result.stderr)


if __name__=="__main__":
    unittest.main()
