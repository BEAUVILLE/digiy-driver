// assets/js/supabase-loader.js
let __supabasePromise = null;

export async function loadSupabase(){
  if (window.supabase?.createClient) return window.supabase;
  if (__supabasePromise) return __supabasePromise;

  __supabasePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.async = true;
    s.onload = () => resolve(window.supabase);
    s.onerror = () => reject(new Error("Supabase CDN failed"));
    document.head.appendChild(s);
  });

  return __supabasePromise;
}

// helper: run when browser is idle (fallback)
export function runIdle(fn){
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => fn(), { timeout: 1500 });
  } else {
    setTimeout(fn, 250);
  }
}
