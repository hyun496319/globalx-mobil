export default {
  async fetch(request) {
    const CORS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const req = new URL(request.url);
    const raw = req.searchParams.get('url');
    if (!raw) return out({ok:true,name:'GlobalX Cheonyu Collector',usage:'?url=CHEONYU_PRODUCT_URL'}, CORS);
    let target;
    try { target = new URL(raw); } catch { return out({ok:false,error:'상품 URL 형식이 올바르지 않습니다.'}, CORS, 400); }
    if (!/(^|\.)cheonyu\.com$/i.test(target.hostname)) return out({ok:false,error:'현재 천유닷컴 상품 URL만 지원합니다.'}, CORS, 400);

    try {
      const r = await fetch(target.href, {headers:{
        'User-Agent':'Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language':'ko-KR,ko;q=0.9,en;q=0.8',
        'Referer':'https://www.cheonyu.com/'
      }});
      if (!r.ok) return out({ok:false,error:`천유 응답 오류 ${r.status}`}, CORS, 502);
      const html = await r.text();
      const text = decode(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' '));
      const title = clean(meta(html,'og:title') || ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||''));
      const images = collectImages(html, target).slice(0,120);
      const pick = (re) => ((text.match(re)||[])[1]||'').trim();
      const productNo = target.searchParams.get('qIDX') || pick(/(?:상품번호|상품코드)\s*[:：]?\s*([0-9]+)/i);
      const barcode = pick(/(?:바코드|barcode)\s*[:：]?\s*([0-9]{8,14})/i);
      const price = pick(/(?:도매가|판매가|가격)\s*[:：]?\s*([0-9,]+)\s*원/i);
      const maker = pick(/(?:제조사|제조원|브랜드)\s*[:：]?\s*([^|]{1,40}?)(?=\s{2,}|원산지|사이즈|크기|중량|무게|$)/i);
      const size = pick(/(?:사이즈|크기|규격)\s*[:：]?\s*([0-9.,]+\s*[xX×*]\s*[0-9.,]+(?:\s*[xX×*]\s*[0-9.,]+)?\s*(?:mm|cm)?)/i);
      const weight = pick(/(?:무게|중량)\s*[:：]?\s*([0-9.,]+\s*(?:kg|g))/i);
      return out({ok:true,source:'cheonyu',productNo,title,barcode,price,maker,size,weight,imageCount:images.length,images,url:target.href}, CORS);
    } catch (e) {
      return out({ok:false,error:e?.message || String(e)}, CORS, 500);
    }
  }
};

function out(data, headers, status=200){ return new Response(JSON.stringify(data,null,2),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}}); }
function decode(s=''){ return s.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)); }
function clean(s=''){ return decode(s).replace(/\s*[-|]\s*천유.*$/i,'').replace(/\s+/g,' ').trim(); }
function meta(html,key){ const a=html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,'i')); const b=html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,'i')); return decode((a||b||[])[1]||''); }
function abs(raw,base){ if(!raw) return ''; raw=decode(raw).trim(); if(raw.startsWith('data:')||raw.startsWith('javascript:')) return ''; if(raw.startsWith('//')) raw='https:'+raw; try{return new URL(raw,base).href}catch{return ''} }
function good(u){ if(!u) return false; const x=u.toLowerCase(); return /\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(x) && !/(logo|icon|banner|button|btn_|loading|spinner|blank\.|common\/)/i.test(x); }
function collectImages(html,base){ const set=new Set(); const og=meta(html,'og:image'); if(good(abs(og,base))) set.add(abs(og,base)); const attr=/(?:src|data-src|data-original|data-lazy-src|data-url)\s*=\s*["']([^"']+)["']/gi; let m; while((m=attr.exec(html))){const u=abs(m[1],base); if(good(u)) set.add(u);} const srcset=/srcset\s*=\s*["']([^"']+)["']/gi; while((m=srcset.exec(html))){for(const c of m[1].split(',')){const u=abs(c.trim().split(/\s+/)[0],base); if(good(u)) set.add(u);}} const direct=html.match(/(?:https?:)?\/\/[^"'()\s<>]+?\.(?:jpe?g|png|webp|gif)(?:\?[^"'()\s<>]*)?/gi)||[]; for(const x of direct){const u=abs(x,base); if(good(u)) set.add(u);} return [...set]; }
