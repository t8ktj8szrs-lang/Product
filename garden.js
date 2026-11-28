/* Budgtree Eco-Garden: plant-only garden with seed packets and timed growth stages. */
(() => {
  'use strict';

  const el = id => document.getElementById(id);

  const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const today = () => { const d=new Date();
return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

  const LEVELS = [0, 30, 100, 180, 280, 400, 550, 750, 1000];

  const GROWTH = [
    { name: 'Seed', hours: 0, emoji: '🌰' },
    { name: 'Sprout', hours: 6, emoji: '🌱' },
    { name: 'Seedling', hours: 24, emoji: '🌿' },
    { name: 'Growing', hours: 72, emoji: '🪴' },
    { name: 'Mature', hours: 168, emoji: '🌼' }
  ];

  const PLANTS = [
    { id:'tulip', name:'Tulip', emoji:'🌷', cost:5, level:1, desc:'A soft pink flower for the garden.' },
    { id:'sunflower', name:'Sunflower', emoji:'🌻', cost:5, level:1, desc:'A bright flower that loves the sun.' },
    { id:'monstera', name:'Monstera', emoji:'🌿', cost:8, level:1, desc:'A leafy tropical potted plant.' },
    { id:'potted-sunflower', name:'Potted Sunflower', emoji:'🌻', cost:9, level:2, desc:'A cheerful pot filled with sunflowers.' },
    { id:'cactus', name:'Cactus', emoji:'🌵', cost:7, level:2, desc:'A hardy desert plant in a terracotta pot.' },
    { id:'daisy', name:'Daisy Patch', emoji:'🌼', cost:8, level:2, desc:'A small patch of happy white daisies.' },
    { id:'lavender', name:'Lavender', emoji:'🪻', cost:9, level:3, desc:'Purple flower spikes with calming color.' },
    { id:'succulent', name:'Succulent', emoji:'🪴', cost:10, level:3, desc:'A compact rosette succulent.' }
  ];

  const CATEGORIES = ['Food','Transportation','School Expenses','Personal Needs','Shopping','Entertainment','Allowance','Other'];

  const ACHIEVEMENTS = [
    { id:'firstTx', name:'First Transaction', desc:'Record your first transaction.', emoji:'🧾', reward:3, test:()=>data.transactions.length>=1 },
    { id:'firstGoal', name:'First Savings Goal', desc:'Create your first savings goal.', emoji:'🎯', reward:3, test:()=>data.goals.length>=1 },
    { id:'fiveTx', name:'Getting Consistent', desc:'Record five transactions.', emoji:'📚', reward:5, test:()=>data.transactions.length>=5 },
    { id:'budget', name:'Budget Planner', desc:'Set up your first budget plan.', emoji:'📊', reward:5, test:()=>Object.values(data.budgets||{}).some(v=>Number(v)>0) },
    { id:'milestone', name:'First Savings Milestone', desc:'Reach 25% of a savings goal.', emoji:'🏁', reward:5, test:()=>data.goals.some(g=>Number(g.target)>0&&Number(g.saved)>=Number(g.target)*.25) },
    { id:'visits', name:'Growing Consistency', desc:'Visit Budgtree on seven different days.', emoji:'🌱', reward:7, test:()=>new Set((garden.history||[]).filter(x=>x.type==='earned'&&x.source==='daily').map(x=>x.date)).size>=7 },
    { id:'firstItem', name:'Garden Starter', desc:'Plant your first seed.', emoji:'🌷', reward:3, test:()=>garden.placed.length>0 }
  ];

  const defaults = () => ({ version:2, balance:0, lifetimeEarned:0, totalSpent:0, level:1, inventory:{tulip:1}, placed:[], achievements:{}, history:[], rewards:{ initialized:false,lastVisit:null,seenTransactionIds:[],seenTransactionFingerprints:[],seenGoals:[],budgetAwarded:false,goalRewardDate:null,firstMilestoneGoals:[],claimed:{} } });

  let garden = defaults(), selectedSeed = null, activeTab = 'inventory', growthTimer = null;

  function safe(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
  function levelFor(total) { let level=1;
for(let i=1;
i<LEVELS.length;
i++){ if(total>=LEVELS[i]) level=i+1;
else break;
} return level;
}
  function ensure() {
    if (!data.garden || typeof data.garden !== 'object') data.garden = defaults();

    const old = data.garden, d = defaults();

    garden = { ...d, ...old, inventory:{...d.inventory,...(old.inventory||{})}, rewards:{...d.rewards,...(old.rewards||{})}, achievements:{...(old.achievements||{})}, history:Array.isArray(old.history)?old.history:[], placed:Array.isArray(old.placed)?old.placed:[] };

    // Migrate only actual plants from the old garden. Pets, wildlife and decorations are intentionally discarded.
    garden.placed = garden.placed.filter(p => PLANTS.some(item=>item.id===p.itemId)).map(p=>({ id:p.id||uid(), itemId:p.itemId, slot:Number(p.slot)||0, plantedAt:Number(p.plantedAt)||Date.now(), lastWatered:p.lastWatered||null, waterBonus:Number(p.waterBonus)||0 }));

    Object.keys(garden.inventory).forEach(id=>{ if(!PLANTS.some(p=>p.id===id)) delete garden.inventory[id];
});

    garden.balance=Math.max(0,Number(garden.balance)||0);
garden.lifetimeEarned=Math.max(0,Number(garden.lifetimeEarned)||0);
garden.totalSpent=Math.max(0,Number(garden.totalSpent)||0);

    garden.level=levelFor(garden.lifetimeEarned);
data.garden=garden;

  }
  function record(label, amount, type='earned', source='activity') { garden.history.unshift({id:uid(),label,amount,type,source,date:today(),at:Date.now()});
garden.history=garden.history.slice(0,60);
}
  function award(key,label,amount,source) {
    garden.rewards.claimed=garden.rewards.claimed||{};
if(garden.rewards.claimed[key]) return false;

    garden.rewards.claimed[key]=true;
garden.balance+=amount;
garden.lifetimeEarned+=amount;
garden.level=levelFor(garden.lifetimeEarned);
record(label,amount,'earned',source);
return true;

  }
  function spend(amount,label) { amount=Number(amount)||0;
if(amount<=0||garden.balance<amount) return false;
garden.balance-=amount;
garden.totalSpent+=amount;
record(label,-amount,'spent','purchase');
return true;
}
  function fingerprint(t) { return [String(t.type||''),String(t.description||'').trim().toLowerCase(),String(t.category||''),String(t.date||''),Number(t.amount||0).toFixed(2)].join('|');
}
  function syncRewards() {
    ensure();
const r=garden.rewards, txs=Array.isArray(data.transactions)?data.transactions:[];
let changed=false;

    const fps=new Set(r.seenTransactionFingerprints||[]), ids=new Set(r.seenTransactionIds||[]);

    txs.forEach(t=>{const fp=fingerprint(t),id=String(t.id||fp);
if(!ids.has(id)){ids.add(id);
if(!fps.has(fp)){fps.add(fp);
changed=award('tx:'+fp,'Transaction recorded',1,'transaction')||changed;
}}});

    r.seenTransactionIds=Array.from(ids).slice(-1000);
r.seenTransactionFingerprints=Array.from(fps).slice(-1000);

    const goals=new Set(r.seenGoals||[]);
(data.goals||[]).forEach(g=>{if(!goals.has(g.id)){goals.add(g.id);
if(r.goalRewardDate!==today()){changed=award('goal:'+g.id,'Savings goal created',3,'goal')||changed;
r.goalRewardDate=today();
}}});
r.seenGoals=Array.from(goals);

    if(!r.budgetAwarded&&Object.values(data.budgets||{}).some(v=>Number(v)>0)){r.budgetAwarded=true;
changed=award('budget:first','Budget plan completed',5,'budget')||changed;
}
    const milestones=new Set(r.firstMilestoneGoals||[]);
(data.goals||[]).forEach(g=>{if(Number(g.target)>0&&Number(g.saved)>=Number(g.target)*.25&&!milestones.has(g.id)){milestones.add(g.id);
changed=award('milestone:'+g.id,'Savings milestone reached',5,'milestone')||changed;
}});
r.firstMilestoneGoals=Array.from(milestones);

    ACHIEVEMENTS.forEach(a=>{if(!garden.achievements[a.id]&&a.test()){garden.achievements[a.id]={unlockedAt:Date.now(),reward:a.reward};
changed=award('achievement:'+a.id,'Achievement: '+a.name,a.reward,'achievement')||changed;
}});

    return changed;

  }
  function persist(message) { syncRewards();
return saveData().then(()=>{render();
if(message)toast(message);
}).catch(err=>{console.error('Eco-Garden save failed:',err);
toast('Could not save your garden change. Please try again.','error');
});
}
  function growthFor(plant) { const hours=Math.max(0,(Date.now()-plant.plantedAt)/3600000)+(Number(plant.waterBonus)||0);
let index=0;
for(let i=0;
i<GROWTH.length;
i++) if(hours>=GROWTH[i].hours) index=i;
return { ...GROWTH[index], index, hours, next:GROWTH[index+1]||null };
}
  function onLogin() {
    ensure();
const r=garden.rewards;

    if(!r.initialized){r.seenTransactionFingerprints=(data.transactions||[]).map(fingerprint);
r.seenTransactionIds=(data.transactions||[]).map(t=>String(t.id||fingerprint(t)));
r.seenGoals=(data.goals||[]).map(g=>g.id);
r.budgetAwarded=Object.values(data.budgets||{}).some(v=>Number(v)>0);
r.firstMilestoneGoals=(data.goals||[]).filter(g=>Number(g.target)>0&&Number(g.saved)>=Number(g.target)*.25).map(g=>g.id);
r.initialized=true;
}
    if(r.lastVisit!==today()){award('daily:'+today(),'Daily garden visit',2,'daily');
r.lastVisit=today();
}
    syncRewards();
return saveData().catch(err=>{console.error('Eco-Garden save:',err);
toast('Garden progress could not sync. Please try again.','error');
});

  }
  function buySeed(id) { const item=PLANTS.find(p=>p.id===id);
if(!item)return;
if(garden.level<item.level){toast(`Reach garden level ${item.level} to unlock this seed.`);
return;
} if(!spend(item.cost,`Bought ${item.name} seeds`)){toast('Not enough EcoSeeds.','error');
return;
} garden.inventory[id]=(garden.inventory[id]||0)+1;
persist(`${item.name} seed packet added to your inventory.`);
}
  function plantSeed(id,slot) { const item=PLANTS.find(p=>p.id===id);
if(!item||!garden.inventory[id])return;
if(garden.placed.some(p=>p.slot===slot)){toast('That plot is already occupied.');
return;
} garden.inventory[id]--;
garden.placed.push({id:uid(),itemId:id,slot,plantedAt:Date.now(),lastWatered:null,waterBonus:0});
selectedSeed=null;
persist(`${item.name} seed planted! It will grow over time.`);
}
  function waterPlant(id) { const p=garden.placed.find(x=>x.id===id);
if(!p)return;
if(p.lastWatered===today()){toast('You have already watered this plant today.');
return;
} p.lastWatered=today();
p.waterBonus=(Number(p.waterBonus)||0)+3;
persist('Plant watered! It received a little growth boost.');
}
  function harvestPlant(id) { const p=garden.placed.find(x=>x.id===id);
if(!p)return;
const item=PLANTS.find(x=>x.id===p.itemId);
garden.inventory[p.itemId]=(garden.inventory[p.itemId]||0)+1;
garden.placed=garden.placed.filter(x=>x.id!==id);
persist(`${item?.name||'Plant'} returned to your seed inventory.`);
}
  function renderSlots() {
    const host=el('gardenSlots');
if(!host)return;

    host.innerHTML=Array.from({length:12},(_,slot)=>{const p=garden.placed.find(x=>x.slot===slot);
if(!p)return `<button type="button" class="garden-slot ${selectedSeed?'is-selected':''}" data-garden-slot="${slot}" aria-label="${selectedSeed?'Plant seed in':'Empty'} plot ${slot+1}">${selectedSeed?'<span class="empty-plot-mark">＋</span>':''}</button>`;

      const item=PLANTS.find(x=>x.id===p.itemId), stage=growthFor(p), imagePath=`./assets/plants/${p.itemId}-stage-${stage.index}.png`;

      return `<button type="button" class="garden-slot has-item plant-stage-${stage.index}" data-placed="${p.id}" title="${safe(item.name)} · ${stage.name}"><span class="placed-plant"><img src="${imagePath}" alt="${safe(stage.name)} ${safe(item.name)}" onerror="this.nextElementSibling.hidden=false;this.remove()"><span class="plant-emoji-fallback" hidden>${stage.emoji}</span></span><span class="slot-label">${safe(stage.name)}</span></button>`;

    }).join('');

  }
  function renderInventory() {
    const inv=el('gardenInventory'),shop=el('gardenShop');
if(!inv||!shop)return;

    const owned=PLANTS.filter(p=>(garden.inventory[p.id]||0)>0);

    el('gardenInventoryCount').textContent=owned.reduce((n,p)=>n+garden.inventory[p.id],0)+' seed packets';

    inv.innerHTML=owned.length?owned.map(p=>`<div class="garden-inventory-item"><span>${p.emoji}</span><div><b>${safe(p.name)} seeds ×${garden.inventory[p.id]}</b><small>Seed packet · Plant to begin growing</small></div><button type="button" data-select-item="${p.id}" ${selectedSeed===p.id?'disabled':''}>${selectedSeed===p.id?'Selected':'Plant'}</button></div>`).join(''):'<div class="garden-empty-state">No seeds yet. Visit the seed shop to get your first packet.</div>';

    shop.innerHTML=PLANTS.map(p=>{const locked=garden.level<p.level;
return `<div class="garden-shop-item"><span>${p.emoji}</span><b>${safe(p.name)} seeds</b><small>${safe(p.desc)}<br>Level ${p.level} · ${p.cost} EcoSeeds</small><button type="button" data-buy-item="${p.id}" ${locked||garden.balance<p.cost?'disabled':''}>${locked?'Unlock at level '+p.level:'Buy seed packet · '+p.cost+' ✦'}</button></div>`;
}).join('');

  }
  function renderProgress() {
    const level=garden.level,cur=LEVELS[level-1]||0,next=LEVELS[Math.min(level,LEVELS.length-1)]??LEVELS.at(-1),pct=level>=LEVELS.length?100:Math.max(0,Math.min(100,(garden.lifetimeEarned-cur)/(next-cur)*100));

    el('gardenHeadingSeeds').textContent=garden.balance;
el('gardenBalanceStat').textContent=garden.balance;
el('gardenLevelStat').textContent='Level '+level;
el('gardenLevelBadge').textContent=level;

    el('gardenProgressTitle').textContent='Level '+level+' · '+(['Starter garden','Blooming garden','Growing grove','Flourishing garden','Garden retreat','Secret garden','Flower meadow','Botanical garden'][level-1]||'Flourishing garden');

    el('gardenProgressFill').style.width=pct+'%';
el('gardenProgressText').textContent=level>=LEVELS.length?'Maximum garden level reached':`${garden.lifetimeEarned} / ${next} lifetime EcoSeeds to next level`;

    el('gardenPlantCount').textContent=garden.placed.length;
el('rewardsBalance').textContent=garden.balance;
el('rewardAvailable').textContent=garden.balance;
el('rewardLifetime').textContent=garden.lifetimeEarned;
el('rewardUnlocked').textContent=Object.keys(garden.achievements).length+' / '+ACHIEVEMENTS.length;

  }
  function renderRewards() {
    const grid=el('achievementGrid');
if(!grid)return;

    grid.innerHTML=ACHIEVEMENTS.map(a=>{const unlocked=!!garden.achievements[a.id];
return `<article class="achievement-card ${unlocked?'unlocked':''}"><span>${unlocked?a.emoji:'🔒'}</span><b>${a.name}</b><small>${a.desc}</small><em>${unlocked?'Unlocked':'Reward: '+a.reward+' EcoSeeds'}</em></article>`;
}).join('');

    const hist=el('seedHistory');
if(hist)hist.innerHTML=garden.history.length?garden.history.slice(0,25).map(h=>`<div class="seed-history-row"><span>${h.type==='spent'?'🛍️':'✦'}</span><div><b>${safe(h.label)}</b><small>${safe(h.date||'')}</small></div><strong class="${h.type==='spent'?'negative':''}">${h.amount>0?'+':''}${h.amount} EcoSeeds</strong></div>`).join(''):'<div class="garden-empty-state">Your EcoSeeds activity will appear here.</div>';

  }
  function render() { if(!el('page-garden'))return;
ensure();
renderProgress();
renderSlots();
renderInventory();
renderRewards();
if(growthTimer)clearInterval(growthTimer);
growthTimer=setInterval(()=>{if(el('page-garden')?.classList.contains('active'))renderSlots();
},60000);
}
  function bind() {
    document.addEventListener('click',event=>{
      const tab=event.target.closest('[data-garden-tab]');
if(tab){activeTab=tab.dataset.gardenTab;
document.querySelectorAll('[data-garden-tab]').forEach(b=>b.classList.toggle('active',b===tab));
el('gardenInventory').classList.toggle('hidden',activeTab!=='inventory');
el('gardenShop').classList.toggle('hidden',activeTab!=='shop');
el('gardenInventoryHint').textContent=activeTab==='inventory'?'Choose a seed packet, then select an empty garden plot.':'Buy seed packets with virtual EcoSeeds, then plant them in an empty plot.';
return;
}
      const buy=event.target.closest('[data-buy-item]');
if(buy){buySeed(buy.dataset.buyItem);
return;
}
      const select=event.target.closest('[data-select-item]');
if(select){selectedSeed=select.dataset.selectItem;
activeTab='inventory';
el('gardenInventory').classList.remove('hidden');
el('gardenShop').classList.add('hidden');
document.querySelectorAll('[data-garden-tab]').forEach(b=>b.classList.toggle('active',b.dataset.gardenTab==='inventory'));
render();
el('gardenInventoryHint').textContent='Now choose an empty plot to plant your seed.';
return;
}
      const slot=event.target.closest('[data-garden-slot]');
if(slot){if(!selectedSeed){toast('Choose a seed packet first.');
return;
}plantSeed(selectedSeed,Number(slot.dataset.gardenSlot));
return;
}
      const placed=event.target.closest('[data-placed]');
if(placed){const p=garden.placed.find(x=>x.id===placed.dataset.placed);
if(!p)return;
const stage=growthFor(p);
const action=prompt(`${stage.name} · ${stage.next?`${Math.max(0,stage.next.hours-stage.hours).toFixed(1)} growth hours to next stage`:'Fully grown'}\nType W to water (once daily) or H to harvest and return the seed to inventory.`,'W');
if(action?.toLowerCase()==='w')waterPlant(p.id);
else if(action?.toLowerCase()==='h')harvestPlant(p.id);
return;
}
    });

  }
  window.EcoGarden={onLogin,render,syncRewards,awardSeeds:(key,label,amount)=>{ensure();
const ok=award(key,label,amount,'manual');
return ok?persist(`${label} · +${amount} EcoSeeds`):Promise.resolve(false);
}};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);
else bind();

})();
