"""DRIVER MASTER WORLD10: audit the authenticated software, not the public gallery."""
import json
import re
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ACCESS=(ROOT/"acces-proprietaire.html").read_text(encoding="utf-8")
GESTION=(ROOT/"gestion.html").read_text(encoding="utf-8")
SCRIPT=(ROOT/"world10-pro.js").read_text(encoding="utf-8")

def rows():
    m=re.search(r" const rows=(\[.*\]);\n const phrases=new Map\(\);", SCRIPT)
    assert m, "driver WORLD10 dictionary"
    return json.loads(m.group(1))


class DriverMasterWorld10(unittest.TestCase):
    def test_real_software_not_gallery_uses_ten_locales(self):
        languages=['fr','en','es','pt','de','it','nl','ar','wo','zh']
        self.assertIn('const langs='+json.dumps(languages,separators=(',',':')),SCRIPT)
        items=rows()
        self.assertGreaterEqual(len(items),85)
        self.assertEqual(len(items),len({row[0] for row in items}))
        for row in items:
            self.assertEqual(len(row),len(languages),row[0])
            self.assertTrue(all(isinstance(value,str) and value.strip() for value in row),row[0])
        self.assertIn("MutationObserver",SCRIPT)
        self.assertIn("lang===\"ar\"?\"rtl\":\"ltr\"",SCRIPT)
        self.assertIn('id="driverWorld10Pro"',SCRIPT)

    def test_both_authenticated_pages_load_translator_once(self):
        for name,html in [("login",ACCESS),("cockpit",GESTION)]:
            self.assertEqual(html.count('<script src="./world10-pro.js" defer></script>'),1,name)
        translated={row[0] for row in rows()}
        for label in ["Accéder à mon chauffeur.","RECEVOIR MON ACCÈS →",
                      "Présence chauffeur","Profil public","Mes courses, extras & prix",
                      "Enregistrer mon profil","Retirer","✅ Trajet et prix enregistrés.",
                      "⚠️ Code invalide ou expiré.","Langue"]:
            self.assertIn(label,translated)

    def test_no_static_french_ui_missing_translation(self):
        keys={row[0] for row in rows()}
        nontranslate={"🚗 DIGIY DRIVER","🚗 DRIVER MASTER",
                      "Saly","+221 77 000 00 00","https://..."}
        for name,html in [("login",ACCESS),("cockpit",GESTION)]:
            plain=re.sub(r"<script\b[^>]*>[\s\S]*?</script>","",html,flags=re.I)
            plain=re.sub(r"<style\b[^>]*>[\s\S]*?</style>","",plain,flags=re.I)
            labels={part.strip() for part in re.sub(r"<[^>]+>","|",plain).replace("&amp;","&").split("|")
                    if len(part.strip())>=3 and re.search("[A-Za-zÀ-ÿ]",part)}
            labels.update(re.findall(r'(?:placeholder|aria-label|title)="([^"]+)"',plain))
            self.assertFalse(labels-keys-nontranslate,(name,sorted(labels-keys-nontranslate)))

    def test_magic_link_language_and_profile_owner_preserved(self):
        self.assertIn("emailRedirectTo:redirect()",ACCESS)
        self.assertIn("shouldCreateUser:false",ACCESS)
        self.assertIn("get('lang')",ACCESS)
        self.assertIn("digiy_driver_master_lang",ACCESS)
        self.assertIn("encodeURIComponent(chosen.slug)",ACCESS)
        self.assertIn("encodeURIComponent(currentLang())",ACCESS)
        self.assertIn("encodeURIComponent(currentLang())",GESTION)
        self.assertIn("if(requestedSlug && !chosen)",ACCESS)
        self.assertIn("if(!validSlug) return msg(",GESTION)
        self.assertIn(".eq('slug',slug).eq('owner_id',session.user.id).eq('is_active',true)",GESTION)
        self.assertNotIn("||'baptiste-driver-ambassador'",GESTION)

    def test_business_information_and_rpcs_unchanged(self):
        for key in ["digiy_driver_master_set_profile_v1",
                    "digiy_driver_master_set_details_v1",
                    "digiy_driver_master_set_contact_v1",
                    "digiy_driver_master_set_presence_v1",
                    "digiy_driver_master_upsert_rate_v1",
                    "digiy_driver_master_disable_rate_v1",
                    "digiy_driver_master_list_rates_v1"]:
            self.assertIn(key,GESTION)
        self.assertIn('el.closest("#title")',SCRIPT)
        self.assertIn('"#ratesListOwner .trip strong,#ratesListOwner .trip .muted"',SCRIPT)
        self.assertNotIn("supabase.createClient",SCRIPT)
        self.assertNotIn(".rpc(",SCRIPT)
        self.assertNotIn("innerHTML=",SCRIPT)
        self.assertNotIn("fetch(",SCRIPT)

    def test_javascript_syntax(self):
        result=subprocess.run(["node","--check",str(ROOT/"world10-pro.js")],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        for name,html in [("login",ACCESS),("cockpit",GESTION)]:
            for attrs,js in re.findall(r"<script\b([^>]*)>([\s\S]*?)</script>",html):
                if "src=" in attrs or not js.strip(): continue
                result=subprocess.run(["node","--check","-"],input=js,text=True,capture_output=True)
                self.assertEqual(result.returncode,0,name+": "+result.stderr)


if __name__=="__main__":
    unittest.main()
