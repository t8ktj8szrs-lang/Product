/* Budgtree Eco-Garden: account-scoped virtual garden, pet interactions, rewards and wildlife. */
(function(){
  'use strict';
  const el=id=>document.getElementById(id);
  const DEFAULTS=()=>({version:1,balance:0,lifetimeEarned:0,totalSpent:0,level:1,pet:null,food:2,inventory:{daisy:1},placed:[{id:'starter-sunflower',itemId:'sunflower',slot:3,level:1,plantedAt:Date.now(),lastTended:null},{id:'starter-tulip',itemId:'tulip',slot:8,level:1,plantedAt:Date.now(),lastTended:null}],wildlife:{caterpillarProgress:0,caterpillarBornAt:Date.now(),caterpillarTransformed:false},achievements:{},history:[],rewards:{initialized:false,lastVisit:null,seenTransactions:[],seenTransactionIds:[],seenGoals:[],seenTransactionFingerprints:[],budgetAwarded:false,goalRewardDate:null,firstMilestoneGoals:[],claimed:{}},lastPetAction:null});
  const PETS={bunny:{name:'Bunny',emoji:'🐰'},bear:{name:'Bear',emoji:'🐻'},dino:{name:'Dino',emoji:'🦕'}};
  const STAGES=[{name:'Baby',at:0},{name:'Toddler',at:30},{name:'Young',at:100},{name:'Mature',at:220},{name:'Fully grown',at:400}];
  const LEVELS=[0,30,100,180,280,400,550,750,1000];
  const ITEMS=[
    {id:'sunflower',name:'Sunflower',emoji:'🌻',cost:4,kind:'plant',level:1,desc:'A cheerful flower for sunny spots.'},
    {id:'tulip',name:'Tulips',emoji:'🌷',cost:5,kind:'plant',level:1,desc:'A soft touch of color.'},
    {id:'daisy',name:'Daisy',emoji:'🌼',cost:5,kind:'plant',level:1,desc:'A little flower visitors love.'},
    {id:'rose',name:'Rose bush',emoji:'🌹',cost:9,kind:'plant',level:2,desc:'A blooming garden favorite.'},
    {id:'sprout',name:'Potted sprout',emoji:'🪴',cost:7,kind:'plant',level:2,desc:'A tiny green addition.'},
    {id:'appletree',name:'Apple tree',emoji:'🍎',cost:18,kind:'tree',level:3,desc:'A home for garden birds.'},
    {id:'cherry',name:'Cherry tree',emoji:'🍒',cost:22,kind:'tree',level:5,desc:'A special tree for a growing garden.'},
    {id:'bench',name:'Garden bench',emoji:'🪑',cost:8,kind:'decor',level:2,desc:'A quiet place to rest.'},
    {id:'birdhouse',name:'Birdhouse',emoji:'🏡',cost:12,kind:'decor',level:4,desc:'Invite more birds to visit.'},
    {id:'pond',name:'Small pond',emoji:'🪷',cost:20,kind:'decor',level:6,desc:'A peaceful water feature.'},
    {id:'lantern',name:'Garden lantern',emoji:'🏮',cost:10,kind:'decor',level:3,desc:'A warm evening glow.'},
    {id:'bow',name:'Pet bow',emoji:'🎀',cost:8,kind:'accessory',level:2,desc:'A cute accessory for your companion.'},
    {id:'scarf',name:'Pet scarf',emoji:'🧣',cost:12,kind:'accessory',level:4,desc:'A cozy look for your pet.'},
    {id:'crown',name:'Flower crown',emoji:'👑',cost:20,kind:'accessory',level:6,desc:'A special garden crown.'}
  ];
  const WILDLIFE=[
    {id:'butterfly',name:'Butterfly',emoji:'🦋',level:1,behavior:'Flutters between the flowers.'},
    {id:'caterpillar',name:'Caterpillar',emoji:'🐛',level:2,behavior:'Nibbles on leaves and grows into a butterfly.'},
    {id:'ladybug',name:'Ladybug',emoji:'🐞',level:2,behavior:'Wanders across the garden leaves.'},
    {id:'bee',name:'Bee',emoji:'🐝',level:3,behavior:'Visits flowers to collect nectar.'},
    {id:'bird',name:'Bird',emoji:'🐦',level:4,behavior:'Perches on trees and sings.'},
    {id:'rabbit',name:'Rabbit',emoji:'🐇',level:5,behavior:'Hops and rests in the grass.'},
    {id:'dragonfly',name:'Dragonfly',emoji:'🪰',level:6,behavior:'Flies around the water feature.'},
    {id:'firefly',name:'Firefly',emoji:'✨',level:7,behavior:'Glows softly in the evening.'}
  ];
  const ACHIEVEMENTS=[
    {id:'firstTx',name:'First Transaction',desc:'Record your first transaction.',emoji:'🧾',reward:3,test:()=>data.transactions.length>=1},
    {id:'firstGoal',name:'First Savings Goal',desc:'Create your first savings goal.',emoji:'🎯',reward:3,test:()=>data.goals.length>=1},
    {id:'fiveTx',name:'Getting Consistent',desc:'Record five transactions.',emoji:'📚',reward:5,test:()=>data.transactions.length>=5},
    {id:'budget',name:'Budget Planner',desc:'Set up your first budget plan.',emoji:'📊',reward:5,test:()=>Object.values(data.budgets||{}).some(v=>Number(v)>0)},
    {id:'milestone',name:'First Savings Milestone',desc:'Reach 25% of a savings goal.',emoji:'🏁',reward:5,test:()=>data.goals.some(g=>Number(g.target)>0&&Number(g.saved)>=Number(g.target)*.25)},
    {id:'visits',name:'Growing Consistency',desc:'Visit Budgtree on seven different days.',emoji:'🌱',reward:7,test:()=>new Set((garden.history||[]).filter(x=>x.type==='earned'&&x.source==='daily').map(x=>x.date)).size>=7},
    {id:'firstItem',name:'Garden Starter',desc:'Unlock your first garden item.',emoji:'🌷',reward:3,test:()=>garden.history.some(h=>h.type==='spent'&&h.source==='purchase'&&String(h.label).startsWith('Purchased '))}
  ];
  let garden=DEFAULTS(), activeTab='inventory', selectedInventoryId=null, initialized=false;
  function ensure(){
    if(!data.garden||typeof data.garden!=='object')data.garden=DEFAULTS();
    garden=data.garden;
    const d=DEFAULTS();
    garden={...d,...garden,inventory:{...d.inventory,...(garden.inventory||{})},wildlife:{...d.wildlife,...(garden.wildlife||{})},rewards:{...d.rewards,...(garden.rewards||{})},achievements:{...(garden.achievements||{})},history:Array.isArray(garden.history)?garden.history:[],placed:Array.isArray(garden.placed)?garden.placed:[]};
    garden.balance=Math.max(0,Number(garden.balance)||0);garden.lifetimeEarned=Math.max(0,Number(garden.lifetimeEarned)||0);garden.totalSpent=Math.max(0,Number(garden.totalSpent)||0);
    garden.level=levelFor(garden.lifetimeEarned);data.garden=garden;
  }
  function levelFor(total){let level=1;for(let i=1;i<LEVELS.length;i++){if(total>=LEVELS[i])level=i+1;else break;}return level;}
  function nextThreshold(level){return LEVELS[Math.min(level,LEVELS.length-1)]??LEVELS[LEVELS.length-1];}
  function stageFor(total){let stage=0;for(let i=0;i<STAGES.length;i++)if(total>=STAGES[i].at)stage=i;return stage;}
  function record(label,amount,type='earned',source='activity'){
    garden.history.unshift({id:uid(),label,amount,type,source,date:today(),at:Date.now()});garden.history=garden.history.slice(0,60);
  }
  function award(key,label,amount,source){
    if(garden.rewards.claimed&&garden.rewards.claimed[key])return false;
    garden.rewards.claimed=garden.rewards.claimed||{};garden.rewards.claimed[key]=true;
    garden.balance+=amount;garden.lifetimeEarned+=amount;garden.level=levelFor(garden.lifetimeEarned);record(label,amount,'earned',source);return true;
  }
  function spend(amount,label,source='purchase'){
    amount=Number(amount)||0;if(amount<=0||garden.balance<amount)return false;
    garden.balance-=amount;garden.totalSpent+=amount;record(label,-amount,'spent',source);return true;
  }
  function fingerprint(t){return [String(t.type||''),String(t.description||'').trim().toLowerCase(),String(t.category||''),String(t.date||''),Number(t.amount||0).toFixed(2)].join('|');}
  function syncRewards(){
    ensure();const r=garden.rewards;let changed=false;
    const txs=Array.isArray(data.transactions)?data.transactions:[];
    const fingerprints=new Set(r.seenTransactionFingerprints||[]),seenIds=new Set(r.seenTransactionIds||[]);
    txs.forEach(t=>{const fp=fingerprint(t),id=String(t.id||fp);if(!seenIds.has(id)){seenIds.add(id);if(!fingerprints.has(fp)){fingerprints.add(fp);changed=award('tx:'+fp,'Transaction recorded',1,'transaction')||changed;}}});
    r.seenTransactionIds=Array.from(seenIds).slice(-1000);r.seenTransactionFingerprints=Array.from(fingerprints).slice(-1000);
    const seenGoals=new Set(r.seenGoals||[]);(data.goals||[]).forEach(g=>{if(!seenGoals.has(g.id)){seenGoals.add(g.id);const todayKey=today();if(r.goalRewardDate!==todayKey){changed=award('goal:'+g.id,'Savings goal created',3,'goal')||changed;r.goalRewardDate=todayKey;}}});r.seenGoals=Array.from(seenGoals);
    if(!r.budgetAwarded&&Object.values(data.budgets||{}).some(v=>Number(v)>0)){r.budgetAwarded=true;changed=award('budget:first','Budget plan completed',5,'budget')||changed;}
    const milestoneIds=new Set(r.firstMilestoneGoals||[]);(data.goals||[]).forEach(g=>{if(Number(g.target)>0&&Number(g.saved)>=Number(g.target)*.25&&!milestoneIds.has(g.id)){milestoneIds.add(g.id);changed=award('milestone:'+g.id,'Savings milestone reached',5,'milestone')||changed;}});r.firstMilestoneGoals=Array.from(milestoneIds);
    ACHIEVEMENTS.forEach(a=>{if(!garden.achievements[a.id]&&a.test()){garden.achievements[a.id]={unlockedAt:Date.now(),reward:a.reward};changed=award('achievement:'+a.id,'Achievement: '+a.name,a.reward,'achievement')||changed;}});
    return changed;
  }
  function onLogin(){
    ensure();const r=garden.rewards;
    if(!r.initialized){r.seenTransactionFingerprints=(data.transactions||[]).map(fingerprint);r.seenTransactionIds=(data.transactions||[]).map(t=>String(t.id||fingerprint(t)));r.seenGoals=(data.goals||[]).map(g=>g.id);r.budgetAwarded=Object.values(data.budgets||{}).some(v=>Number(v)>0);r.firstMilestoneGoals=(data.goals||[]).filter(g=>Number(g.target)>0&&Number(g.saved)>=Number(g.target)*.25).map(g=>g.id);r.initialized=true;}
    if(r.lastVisit!==today()){award('daily:'+today(),'Daily garden visit',2,'daily');r.lastVisit=today();}
    syncRewards();
    if(!garden.pet)garden.pet=null;
    if(typeof saveData==='function')return saveData().catch(err=>{console.error('Eco-Garden save:',err);toast('Garden progress could not sync. Please try again.', 'error');});
  }
  function getPet(){return garden.pet&&PETS[garden.pet.type]?garden.pet:null;}
  function petEmoji(){const p=getPet();return p?PETS[p.type].emoji:'🐾';}
  function petStage(){return stageFor(garden.lifetimeEarned);}
  function feedback(message){const box=el('petFeedback');if(box)box.textContent=message;}
  function choosePet(type){if(!PETS[type]||garden.pet)return;garden.pet={type,name:PETS[type].name,adoptedAt:Date.now(),accessory:null,interactions:{pet:0,play:0,feed:0,rest:0}};render();persist('You adopted '+PETS[type].name+'! Welcome to your garden.');}
  function interact(action){const p=getPet();if(!p)return;const lines={pet:['Your companion leans into your hand. ♡','A little happy wiggle!','Your pet loves the attention.'],play:['Your companion bounces around happily!','Playtime makes the garden brighter.','Your pet chases a leaf.'],feed:['Yum! Your companion enjoyed a treat.','A happy little snack break.'],rest:['Your companion settles down for a peaceful rest.','A cozy little nap in the garden.']};
    if(action==='feed'){if(garden.food<=0){feedback('No treats left. You can get more for 5 EcoSeeds.');toast('Your pet needs a treat. Visit the garden shop.');return;}garden.food--;}
    p.interactions=p.interactions||{pet:0,play:0,feed:0,rest:0};p.interactions[action]=(p.interactions[action]||0)+1;if(action==='rest')p.resting=!p.resting;else p.resting=false;garden.lastPetAction={action,at:Date.now()};
    const arr=lines[action]||lines.pet;feedback(arr[Math.floor(Math.random()*arr.length)]);
    const actor=el('gardenPetActor');if(actor){const heart=document.createElement('i');heart.className='pet-hearts';heart.textContent=action==='feed'?'♥':action==='rest'?'zZ':'♥';actor.appendChild(heart);setTimeout(()=>heart.remove(),1100);}
    if(action==='rest')feedback('Your companion is resting peacefully. It will never lose progress while you are away.');
    persist('Your pet enjoyed that!');
  }
  function persist(message){syncRewards();return saveData().then(()=>{render();if(message)toast(message);}).catch(err=>{console.error('Eco-Garden save failed:',err);toast('Could not save your garden change. Please try again.','error');});}
  function buy(itemId){const item=ITEMS.find(x=>x.id===itemId);if(!item)return;if(garden.level<item.level){toast('Reach garden level '+item.level+' to unlock this item.');return;}if(item.kind==='accessory'&&!getPet()){toast('Adopt your main pet before buying accessories.');return;}if(item.kind==='accessory'&&garden.pet.accessory===item.id){toast('Your pet is already wearing this.');return;}if(!spend(item.cost,'Purchased '+item.name)){toast('Not enough EcoSeeds for this item.','error');return;}if(item.kind==='accessory'){garden.pet.accessory=item.id;}else{garden.inventory[item.id]=(garden.inventory[item.id]||0)+1;}persist(item.name+' unlocked!');}
  function buyTreats(){if(!spend(5,'Pet treats','pet-care')){toast('You need 5 EcoSeeds to get treats.','error');return;}garden.food+=3;persist('You got 3 pet treats.');}
  function placeItem(itemId,slot){const item=ITEMS.find(x=>x.id===itemId);if(!item||!garden.inventory[itemId])return;if(garden.placed.some(p=>p.slot===slot)){toast('That garden spot is already occupied.');return;}garden.inventory[itemId]--;garden.placed.push({id:uid(),itemId,slot,level:1,plantedAt:Date.now(),lastTended:null});selectedInventoryId=null;persist(item.name+' placed in your garden.');}
  function removeItem(id){const placed=garden.placed.find(p=>p.id===id);if(!placed)return;garden.inventory[placed.itemId]=(garden.inventory[placed.itemId]||0)+1;garden.placed=garden.placed.filter(p=>p.id!==id);persist('Item returned to your inventory.');}
  function tendPlant(id){const p=garden.placed.find(x=>x.id===id);if(!p)return;if(p.level>=12){toast('This plant has reached level 12!');return;}const day=today();if(p.lastTended===day){toast('You have already tended this plant today.');return;}p.level++;p.lastTended=day;persist('Your plant grew to level '+p.level+'!');}
  function critterClick(id){if(id==='caterpillar'){if(garden.wildlife.caterpillarTransformed){toast('Your butterfly flutters happily around the garden.');return;}garden.wildlife.caterpillarProgress=(garden.wildlife.caterpillarProgress||0)+1;if(garden.wildlife.caterpillarProgress>=3){garden.wildlife.caterpillarTransformed=true;feedback('Your caterpillar has grown into a butterfly! 🦋');toast('A caterpillar became a butterfly!');}else{feedback('The caterpillar nibbles on a leaf. Growth '+garden.wildlife.caterpillarProgress+'/3.');toast('The caterpillar ate a leaf.');}persist();return;}const animal=WILDLIFE.find(a=>a.id===id);if(animal)toast(animal.name+': '+animal.behavior);}
  function renderPet(){const adoption=el('petAdoption'),controls=el('petControls'),p=getPet();if(!adoption||!controls)return;adoption.classList.toggle('hidden',!!p);controls.classList.toggle('hidden',!p);el('petStagePill').textContent=p?STAGES[petStage()].name:'Waiting for adoption';el('gardenPetStageStat').textContent=p?STAGES[petStage()].name:'Not adopted';if(!p){el('gardenPetLayer').innerHTML='';return;}const stage=STAGES[petStage()],next=STAGES[petStage()+1],progress=next?Math.max(0,Math.min(100,(garden.lifetimeEarned-stage.at)/(next.at-stage.at)*100)):100;el('petPortrait').textContent=petEmoji();el('petNameLabel').textContent=p.name||PETS[p.type].name;el('petStageLabel').textContent=stage.name+' · Stage '+(petStage()+1)+' of 5';el('petGrowthFill').style.width=progress+'%';el('petGrowthText').textContent=next?`${Math.max(0,next.at-garden.lifetimeEarned)} more lifetime EcoSeeds to grow`:'Your companion is fully grown!';el('petFoodCount').textContent=garden.food;
    const accessory=p.accessory?ITEMS.find(i=>i.id===p.accessory)?.emoji||'':'',actor=el('gardenPetLayer');actor.innerHTML=`<button type="button" class="garden-pet-actor ${p.resting?'pet-resting':''}" id="gardenPetActor" data-pet-scene-action="pet" aria-label="Interact with ${safe(p.name)}">${petEmoji()}${accessory?`<span class="pet-accessory">${accessory}</span>`:''}${p.resting?'<span class="pet-sleep-mark">zZ</span>':''}</button>`;
  }
  function renderCritters(){const host=el('gardenCritters');if(!host)return;const unlocked=WILDLIFE.filter(a=>garden.level>=a.level);host.innerHTML=unlocked.map(a=>{const emoji=a.id==='caterpillar'&&garden.wildlife.caterpillarTransformed?'🦋':a.emoji;return `<button type="button" class="garden-critter ${a.id}" data-critter="${a.id}" aria-label="Interact with ${a.name}" title="${a.name}">${emoji}</button>`;}).join('');el('gardenWildlifeStat').textContent=unlocked.length+' species';el('wildlifeCount').textContent=unlocked.length+' species';el('wildlifeCollection').innerHTML=WILDLIFE.map(a=>`<div class="wildlife-card ${garden.level<a.level?'locked':''}"><span>${garden.level>=a.level?(a.id==='caterpillar'&&garden.wildlife.caterpillarTransformed?'🦋':a.emoji):'🔒'}</span><div><b>${a.id==='caterpillar'&&garden.wildlife.caterpillarTransformed?'Butterfly (grown)':a.name}</b><small>${garden.level>=a.level?a.behavior:'Unlock at garden level '+a.level}</small></div></div>`).join('');}
  function renderSlots(){const host=el('gardenSlots');if(!host)return;const slots=Array.from({length:12},(_,i)=>i);host.innerHTML=slots.map(i=>{const p=garden.placed.find(x=>x.slot===i),item=p&&ITEMS.find(x=>x.id===p.itemId);if(p&&item)return `<button type="button" class="garden-slot has-item" data-placed="${p.id}" title="${item.name} · Level ${p.level}"><span class="placed-plant ${p.level>=8?'level-high':''}">${item.emoji}</span><span class="slot-label">Lv. ${p.level}</span></button>`;return `<button type="button" class="garden-slot ${selectedInventoryId?'is-selected':''}" data-garden-slot="${i}" aria-label="Empty garden spot ${i+1}">${selectedInventoryId?'<span class="empty-plot-mark">＋</span>':''}</button>`;}).join('');}
  function renderInventory(){const inv=el('gardenInventory'),shop=el('gardenShop');if(!inv||!shop)return;const owned=ITEMS.filter(i=>i.kind!=='accessory'&&(garden.inventory[i.id]||0)>0);el('gardenInventoryCount').textContent=owned.reduce((s,i)=>s+garden.inventory[i.id],0)+garden.placed.length+' items';inv.innerHTML=owned.length?owned.map(i=>`<div class="garden-inventory-item"><span>${i.emoji}</span><div><b>${i.name} ×${garden.inventory[i.id]}</b><small>${i.kind==='plant'?'Plant':i.kind==='tree'?'Tree':'Decoration'}</small></div><button type="button" data-select-item="${i.id}" ${selectedInventoryId===i.id?'disabled':''}>${selectedInventoryId===i.id?'Selected':'Place'}</button></div>`).join(''):'<div class="garden-empty-state">Your inventory is empty. Visit the garden shop to unlock your first item.</div>';
    shop.innerHTML=ITEMS.map(i=>{const locked=garden.level<i.level,owned=i.kind==='accessory'?(garden.pet?.accessory===i.id):false;return `<div class="garden-shop-item"><span>${i.emoji}</span><b>${i.name}</b><small>${i.desc}<br>Level ${i.level} · ${i.cost} EcoSeeds</small><button type="button" data-buy-item="${i.id}" ${locked||owned||garden.balance<i.cost?'disabled':''}>${locked?'Level '+i.level:owned?'Equipped':'Unlock · '+i.cost+' ✦'}</button></div>`;}).join('');}
  function renderProgress(){const level=garden.level,cur=LEVELS[level-1]||0,next=nextThreshold(level),pct=level>=LEVELS.length?100:Math.max(0,Math.min(100,(garden.lifetimeEarned-cur)/(next-cur)*100));el('gardenHeadingSeeds').textContent=garden.balance;el('gardenBalanceStat').textContent=garden.balance;el('gardenLevelStat').textContent='Level '+level;el('gardenLevelBadge').textContent=level;el('gardenProgressTitle').textContent='Level '+level+' · '+(['Starter garden','Blooming garden','Growing grove','Garden retreat','Wildlife haven','Secret pond','Firefly meadow','Enchanted garden'][level-1]||'Flourishing garden');el('gardenProgressFill').style.width=pct+'%';el('gardenProgressText').textContent=level>=LEVELS.length?'Maximum garden level reached':`${garden.lifetimeEarned} / ${next} lifetime EcoSeeds to next level`;el('rewardsBalance').textContent=garden.balance;el('rewardAvailable').textContent=garden.balance;el('rewardLifetime').textContent=garden.lifetimeEarned;el('rewardUnlocked').textContent=Object.keys(garden.achievements).length+' / '+ACHIEVEMENTS.length;}
  function renderRewards(){const grid=el('achievementGrid');if(!grid)return;grid.innerHTML=ACHIEVEMENTS.map(a=>{const unlocked=!!garden.achievements[a.id];return `<article class="achievement-card ${unlocked?'unlocked':''}"><span>${unlocked?a.emoji:'🔒'}</span><b>${a.name}</b><small>${a.desc}</small><em>${unlocked?'Unlocked':'Reward: '+a.reward+' EcoSeeds'}</em></article>`;}).join('');const hist=el('seedHistory');hist.innerHTML=garden.history.length?garden.history.slice(0,25).map(h=>`<div class="seed-history-row"><span>${h.type==='spent'?'🛍️':'✦'}</span><div><b>${safe(h.label)}</b><small>${safe(h.date||'')}</small></div><strong class="${h.type==='spent'?'negative':''}">${h.amount>0?'+':''}${h.amount} EcoSeeds</strong></div>`).join(''):'<div class="garden-empty-state">Your EcoSeeds activity will appear here.</div>';}
  function render(){if(!el('page-garden'))return;ensure();renderProgress();renderPet();renderCritters();renderSlots();renderInventory();renderRewards();}
  function bind(){
    document.addEventListener('click',e=>{
      const adopt=e.target.closest('[data-adopt-pet]');if(adopt){choosePet(adopt.dataset.adoptPet);return;}
      const petAction=e.target.closest('[data-pet-action]');if(petAction){interact(petAction.dataset.petAction);return;}
      if(e.target.closest('[data-buy-treats]')){buyTreats();return;}
      const tab=e.target.closest('[data-garden-tab]');if(tab){activeTab=tab.dataset.gardenTab;document.querySelectorAll('[data-garden-tab]').forEach(b=>b.classList.toggle('active',b===tab));el('gardenInventory').classList.toggle('hidden',activeTab!=='inventory');el('gardenShop').classList.toggle('hidden',activeTab!=='shop');el('gardenInventoryHint').textContent=activeTab==='inventory'?'Choose an item, then select an empty garden spot to place it.':'Unlock plants, decorations, and accessories with virtual EcoSeeds.';return;}
      const buyButton=e.target.closest('[data-buy-item]');if(buyButton){buy(buyButton.dataset.buyItem);return;}
      const select=e.target.closest('[data-select-item]');if(select){selectedInventoryId=select.dataset.selectItem;activeTab='inventory';el('gardenInventory').classList.remove('hidden');el('gardenShop').classList.add('hidden');document.querySelectorAll('[data-garden-tab]').forEach(b=>b.classList.toggle('active',b.dataset.gardenTab==='inventory'));render();el('gardenInventoryHint').textContent='Now choose an empty spot in the garden to place your item.';return;}
      const slot=e.target.closest('[data-garden-slot]');if(slot){if(!selectedInventoryId){toast('Choose an item from your inventory first.');return;}placeItem(selectedInventoryId,Number(slot.dataset.gardenSlot));return;}
      const placed=e.target.closest('[data-placed]');if(placed){const p=garden.placed.find(x=>x.id===placed.dataset.placed),item=p&&ITEMS.find(i=>i.id===p.itemId);if(!p||!item)return;if(item.kind==='plant'||item.kind==='tree'){const choice=prompt(`${item.name} · Level ${p.level}\nType T to tend this plant (+1 level once per day), or R to return it to inventory.`,'T');if(choice?.toLowerCase()==='t')tendPlant(p.id);else if(choice?.toLowerCase()==='r')removeItem(p.id);}else if(confirm('Return '+item.name+' to your inventory?'))removeItem(p.id);return;}
      const critter=e.target.closest('[data-critter]');if(critter){critterClick(critter.dataset.critter);return;}
      if(e.target.closest('[data-pet-scene-action]')){interact('pet');return;}
    });
  }
  // The main app calls this before its normal render after every successful save.
  window.EcoGarden={onLogin,render,syncRewards,awardSeeds:(key,label,amount)=>{ensure();const ok=award(key,label,amount,'manual');if(ok)return persist(label+' · +'+amount+' EcoSeeds');return Promise.resolve(false);}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();if(typeof user!=='undefined'&&user)onLogin();});else{bind();if(typeof user!=='undefined'&&user)onLogin();}
})();
