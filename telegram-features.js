"use strict";
const PHT = "Asia/Manila";
const esc = value => String(value == null ? "" : value).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const stamp = value => new Intl.DateTimeFormat("en-PH",{timeZone:PHT,month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value || Date.now()));
const isGild = item => /gildenscale/i.test(String(item.name || ""));
const highValue = item => isGild(item) || ["ultimate","legendary"].includes(String(item.rarity || "").toLowerCase());
const quantity = item => Math.max(1,Number(item.quantity)||1);
function summarize(items){const c={total:0,ultimate:0,legendary:0,gildenscale:0,epic:0,rare:0,uncommon:0,common:0};for(const i of items){const q=quantity(i);c.total+=q;if(isGild(i))c.gildenscale+=q;else{const r=String(i.rarity||"common").toLowerCase();if(Object.prototype.hasOwnProperty.call(c,r))c[r]+=q;}}return c;}
function emoji(item){const r=String(item.rarity||"").toLowerCase();if(r==="ultimate")return "🔴";if(r==="legendary")return "🟡";if(isGild(item)){const n=String(item.name||"").toLowerCase();return n.includes("mage")?"🔵":n.includes("warrior")?"🔴":n.includes("guardian")?"🟢":"🟣";}return ({epic:"🟣",rare:"🔵",uncommon:"🟢",common:"⚪"})[r]||"📦";}
function flatten(drops){return drops.flatMap(drop=>(Array.isArray(drop.items)?drop.items:[]).map(item=>({...item,drop})));}
async function runTelegramFeatures({drops,state,saveState,token,chatId}){
  async function api(method,payload){const response=await fetch("https://api.telegram.org/bot"+token+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.description||"Telegram API error");return result.result;}
  async function send(text){await api("sendMessage",{chat_id:chatId,text,parse_mode:"HTML",disable_web_page_preview:true});}
  const items=flatten(drops);const now=Date.now();
  const lastReport=Number(state.telegramReportAt||now-5*60*1000);
  const recentDrops=drops.filter(d=>{const t=Date.parse(d.timestamp||"");return Number.isFinite(t)&&t>lastReport&&t<=now;});
  const recentItems=flatten(recentDrops);const totals=summarize(recentItems);
  await send("📊 <b>BALDHERO ACTIVITY REPORT</b>\n<i>"+esc(stamp(lastReport))+" – "+esc(stamp(now))+" PHT</i>\n\n🏰 Dungeon records: <b>"+recentDrops.length+"</b>\n📦 Total drops: <b>"+totals.total+"</b>\n💎 Rare drops: <b>"+(totals.ultimate+totals.legendary+totals.gildenscale)+"</b>\n\n🔴 Ultimate: "+totals.ultimate+"\n🟡 Legendary: "+totals.legendary+"\n🟣 Gildenscale: "+totals.gildenscale+"\n🟣 Epic: "+totals.epic+"\n🔵 Rare: "+totals.rare+"\n🟢 Uncommon: "+totals.uncommon+"\n⚪ Common: "+totals.common);
  state.telegramReportAt=now;
  const latest=drops[0]||null;
  if(latest){const latestId=String(latest.id||latest.timestamp||"");const latestAt=Date.parse(latest.timestamp||"");if(Number.isFinite(latestAt)&&now-latestAt>=10*60*1000&&state.noDropAlertedFor!==latestId){await send("🚨 <b>BALDHERO DROP ACTIVITY WARNING</b>\n\nNo new drops have been detected for <b>10 minutes</b>.\n🕒 Last drop: <b>"+esc(stamp(latest.timestamp))+"</b>\n⏱️ Quiet period: <b>"+Math.floor((now-latestAt)/60000)+" minutes</b>\n\nThe watcher is still monitoring.");state.noDropAlertedFor=latestId;}else if(latestId!==state.noDropAlertedFor){state.noDropAlertedFor=null;}}
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:PHT,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const hour=Number(new Intl.DateTimeFormat("en-US",{timeZone:PHT,hour:"2-digit",hourCycle:"h23"}).format(new Date()));
  const minute=Number(new Intl.DateTimeFormat("en-US",{timeZone:PHT,minute:"2-digit"}).format(new Date()));
  if(hour===0&&minute<5&&state.telegramDailyDate!==today){const yesterday=new Date(now-86400000);const dayKey=new Intl.DateTimeFormat("en-CA",{timeZone:PHT,year:"numeric",month:"2-digit",day:"2-digit"}).format(yesterday);const dayDrops=drops.filter(d=>new Intl.DateTimeFormat("en-CA",{timeZone:PHT,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(d.timestamp||0))===dayKey);const dayItems=flatten(dayDrops);const c=summarize(dayItems);const rare=dayItems.filter(x=>highValue(x));const best=rare.sort((a,b)=>({ultimate:3,legendary:2}[String(b.rarity||"").toLowerCase()]||1)-({ultimate:3,legendary:2}[String(a.rarity||"").toLowerCase()]||1))[0];await send("🏆 <b>DAILY LOOT SUMMARY</b>\n<i>"+esc(dayKey)+" • PHT</i>\n\n🏰 Dungeon records: <b>"+dayDrops.length+"</b>\n📦 Total drops: <b>"+c.total+"</b>\n🔴 Ultimate: "+c.ultimate+"\n🟡 Legendary: "+c.legendary+"\n🟣 Gildenscale: "+c.gildenscale+"\n🟣 Epic: "+c.epic+"\n🔵 Rare: "+c.rare+"\n🟢 Uncommon: "+c.uncommon+"\n⚪ Common: "+c.common+(best?"\n\n🔥 <b>RAREST DROP</b>\n"+esc(best.name):""));state.telegramDailyDate=today;}
  const offset=Number(state.telegramUpdateOffset||0);
  const updates=await api("getUpdates",{offset,timeout:0,allowed_updates:["message"]});
  for(const update of updates||[]){state.telegramUpdateOffset=Math.max(Number(state.telegramUpdateOffset||0),update.update_id+1);const message=update.message;if(!message||String(message.chat&&message.chat.id)!==String(chatId)||!message.text)continue;const command=message.text.trim().split(/\s+/)[0].toLowerCase();
    if(command==="/help"||command==="/start"){await send("⚔️ <b>BALDHERO LOOT TRACKER</b>\n\n/stats — Overall loot statistics\n/drops — Latest drops\n/history — Recent dungeon runs\n/top — Most collected items\n/help — Commands");}
    else if(command==="/stats"){const c=summarize(items);await send("📊 <b>OVERALL LOOT STATISTICS</b>\n🏰 Dungeon records: <b>"+drops.length+"</b>\n📦 Total items: <b>"+c.total+"</b>\n🔴 Ultimate: "+c.ultimate+"\n🟡 Legendary: "+c.legendary+"\n🟣 Gildenscale: "+c.gildenscale+"\n🟣 Epic: "+c.epic+"\n🔵 Rare: "+c.rare+"\n🟢 Uncommon: "+c.uncommon+"\n⚪ Common: "+c.common);}
    else if(command==="/drops"){await send("📦 <b>LATEST DROPS</b>\n\n"+(items.slice(0,15).map(x=>emoji(x)+" "+esc(x.name)+" ×"+quantity(x)+" — "+esc(stamp(x.drop.timestamp))).join("\n")||"No drops recorded."));}
    else if(command==="/history"){await send("🧾 <b>RECENT DUNGEON HISTORY</b>\n\n"+(drops.slice(0,10).map(d=>"🏰 "+esc(d.dungeon||"Unknown dungeon")+" • "+esc(stamp(d.timestamp))+" • "+(d.items||[]).reduce((n,x)=>n+quantity(x),0)+" items").join("\n")||"No history recorded."));}
    else if(command==="/top"){const map=new Map();items.forEach(x=>map.set(x.name,(map.get(x.name)||0)+quantity(x)));await send("🏆 <b>MOST COLLECTED ITEMS</b>\n\n"+([...map].sort((a,b)=>b[1]-a[1]).slice(0,10).map((x,i)=>(i+1)+". "+esc(x[0])+" ×"+x[1]).join("\n")||"No drops recorded."));}
  }
  saveState(state);
}
module.exports={runTelegramFeatures};