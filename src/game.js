/* Block Frontier - KaiOS 2.5 / Nokia 2720 Flip, no dependencies, ES5. */
(function () {
'use strict';
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');
if (!ctx) { document.getElementById('fatal').hidden = false; return; }
ctx.imageSmoothingEnabled = false;
var W = 240, H = 320, TILE = 16, MAX_EDITS = 12000;
var names = ['Air','Grass','Dirt','Stone','Wood','Leaves','Sand','Snow','Coal','Iron','Crystal','Planks','Torch','Furnace','Wire','Switch','Lamp'];
var colors = ['','#649a41','#865737','#727985','#98613a','#408352','#d8bf74','#d7e7ea','#26292d','#b17f67','#6ebad3','#c68c4a','#ffba4e','#6c6a63','#c44e55','#d79d54','#e5d67e'];
var hardness = [0,1,1,2,2,1,1,1,2,3,3,1,1,2,1,1,1];
var key = {}, screen = 'home', choice = 0, slotChoice = 0, slotAction = 'load', desiredMode = 'survival';
var world = null, player = null, mobs = [], selected = 0, target = 0, editCount = 0;
var menuTab = 0, menuIndex = 0, day = 0, toast = '', toastEnd = 0, lastMove = 0, lastGravity = 0, lastMob = 0, lastSave = 0, lastFrame = 0;
var camX = 0, camY = 0, powered = {}, confirmDelete = -1, rawCache = {}, rawCount = 0, lastRender = 0;
var recipes = [
 {n:'Planks x4',need:[[4,1]],get:[11,4]},
 {n:'Wood pick',need:[[4,2]],tool:1},
 {n:'Stone pick',need:[[3,3],[4,1]],tool:2},
 {n:'Iron pick',need:[[9,3],[4,1]],tool:3},
 {n:'Torches x4',need:[[4,1],[8,1]],get:[12,4]},
 {n:'Furnace',need:[[3,6]],get:[13,1]},
 {n:'Wire x4',need:[[9,1],[10,1]],get:[14,4]},
 {n:'Switch',need:[[4,1],[9,1]],get:[15,1]},
 {n:'Lamp',need:[[14,2],[10,1]],get:[16,1]}
];
var blockOrder = [2,3,4,11,12,13,14,15,16,1,5,6,7,8,9,10];
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rand(n){var x = Math.sin(n*127.1+13.37)*43758.5453;return x-Math.floor(x);}
function hash(x,y,s){return rand(x*127.7 + y*311.7 + s*0.313);}
function noise(x,scale,s){var xx=x/scale,i=Math.floor(xx),t=xx-i;t=t*t*(3-2*t);return hash(i,1,s)*(1-t)+hash(i+1,1,s)*t;}
function biome(x){var a=Math.floor(x/64);var v=hash(a,21,world.seed);return v<.23?1:v<.47?2:v<.70?3:0;}
function surface(x){return 19 + Math.floor((noise(x,19,world.seed)-.5)*7+(noise(x,7,world.seed+77)-.5)*3);}
function tileRaw(x,y){
 if(y>90)return 3;
 var h=surface(x),b=biome(x);
 if(y<h)return 0;
 if(y===h)return b===1?6:b===2?7:1;
 if(y<h+3)return b===1?6:2;
 if(y>h+5){
  var c=noise(x+y*3,5,world.seed+5), d=noise(x-y*2,7,world.seed+43);
  if(c+d>1.46)return 0;
 }
 if(y>h+3){var z=hash(x,y,world.seed);if(z>.988)return 10;if(z>.95)return 9;if(z>.90)return 8;}
 return 3;
}
var uncachedTile = tileRaw;
tileRaw = function(x,y){var k=x+','+y;if(rawCache.hasOwnProperty(k))return rawCache[k];var t=uncachedTile(x,y);if(rawCount>3600){rawCache={};rawCount=0;}rawCache[k]=t;rawCount++;return t;};
function id(x,y){var k=x+','+y;return world.edits.hasOwnProperty(k)?world.edits[k]:tileRaw(x,y);}
function setId(x,y,t){
 var k=x+','+y,exists=world.edits.hasOwnProperty(k);
 if(!exists&&editCount>=MAX_EDITS){notice('World edit limit reached');return false;}
 if(t===tileRaw(x,y)){if(exists){delete world.edits[k];editCount--;} }
 else {world.edits[k]=t;if(!exists)editCount++;}
 return true;
}
function isSolid(t){return t!==0&&t!==5&&t!==12&&t!==14&&t!==15&&t!==16;}
function blocked(x,y){return isSolid(id(x,y))||isSolid(id(x,y-1));}
function item(t){return world.mode==='creative'?99:(world.inv[t]||0);}
function take(t,count){if(world.mode==='creative')return true;if(item(t)<count)return false;world.inv[t]-=count;return true;}
function give(t,count){if(world.mode==='creative'||!t)return;world.inv[t]=(world.inv[t]||0)+count;}
function hasNeed(r){if(world.mode==='creative')return true;for(var i=0;i<r.need.length;i++)if(item(r.need[i][0])<r.need[i][1])return false;return true;}
function craft(){var r=recipes[menuIndex];if(!hasNeed(r)){notice('Not enough resources');return;}for(var i=0;i<r.need.length;i++)take(r.need[i][0],r.need[i][1]);if(r.tool){world.tool=Math.max(world.tool,r.tool);notice('Pickaxe upgraded');}else{give(r.get[0],r.get[1]);notice('Crafted '+r.n);}save();}
function noteText(s){return String(s||'');}
function notice(s){toast=noteText(s);toastEnd=Date.now()+1800;}
function slots(){var a=[];for(var i=0;i<3;i++){var d=null;try{d=JSON.parse(localStorage.getItem('bf_slot_'+i));}catch(e){}a.push(d);}return a;}
function start(i,create){
 var old=null;try{old=JSON.parse(localStorage.getItem('bf_slot_'+i));}catch(e){}
 if(!old||create){world={v:1,slot:i,seed:Math.floor(Math.random()*999999),mode:desiredMode,edits:{},inv:{2:16,4:5},tool:0,clock:0,steps:0,score:0,sw:{},saved:0};world.p={x:0,y:surface(0)-1,face:1,hp:10,food:10};}
 else {world=old;world.slot=i;world.edits=world.edits||{};world.inv=world.inv||{};world.sw=world.sw||{};world.p=world.p||{x:0,y:surface(0)-1,face:1,hp:10,food:10};}
 player=world.p;rawCache={};rawCount=0;editCount=Object.keys(world.edits).length;
 mobs=[];selected=0;target=0;screen='play';lastMove=lastGravity=lastMob=Date.now();lastSave=Date.now();save();notice(world.mode==='creative'?'CREATIVE MODE':'SURVIVAL MODE');
}
function save(){
 if(!world)return;
 world.p=player;world.saved=Date.now();
 try{localStorage.setItem('bf_slot_'+world.slot,JSON.stringify(world));lastSave=Date.now();}
 catch(e){notice('Storage full! Free a world slot');}
}
function saveSoon(){if(Date.now()-lastSave>6000)save();}
function removeSlot(i){try{localStorage.removeItem('bf_slot_'+i);notice('World deleted');}catch(e){notice('Delete failed');}}
function drawText(s,x,y,size,color,align){ctx.font='bold '+(size||10)+'px Arial';ctx.fillStyle='#112031';ctx.textAlign=align||'left';ctx.fillText(s,x+1,y+1);ctx.fillStyle=color||'#ffffff';ctx.fillText(s,x,y);ctx.textAlign='left';}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h));}
function panel(y,h){rect(9,y,222,h,'#112535');rect(10,y+1,220,h-2,'#20364a');rect(12,y+3,216,2,'#35536a');}
function button(s,y,active){rect(22,y,196,25,active?'#548e63':'#2b495d');rect(24,y+2,192,2,active?'#8ccb8c':'#3e6176');drawText(s,120,y+17,12,'#ffffff','center');}
function menuBack(){if(screen==='play'){screen='pause';save();}else if(screen==='pause')screen='play';else if(screen==='inventory')screen='play';else if(screen==='slots')screen='home';else if(screen==='controls')screen='home';else screen='home';}
function homeInput(k){if(k==='ArrowUp'||k==='2'){choice=(choice+3)%4;}else if(k==='ArrowDown'||k==='8'){choice=(choice+1)%4;}else if(k==='Enter'||k==='5'){if(choice===0){slotAction='new';screen='slots';slotChoice=0;}else if(choice===1){slotAction='load';screen='slots';slotChoice=0;}else if(choice===2){desiredMode=desiredMode==='survival'?'creative':'survival';}else screen='controls';}}
function slotInput(k){if(k==='ArrowUp'||k==='2')slotChoice=(slotChoice+2)%3;else if(k==='ArrowDown'||k==='8')slotChoice=(slotChoice+1)%3;else if(k==='Backspace'||k==='SoftLeft')menuBack();else if(k==='0'){if(confirmDelete===slotChoice){removeSlot(slotChoice);confirmDelete=-1;}else {confirmDelete=slotChoice;notice('Press 0 again to delete');}}else if(k==='Enter'||k==='5'){var exists=!!slots()[slotChoice];if(slotAction==='new'&&exists){notice('Slot occupied. Delete first');return;}start(slotChoice,slotAction==='new'||!exists);}}
function eventKey(k,down){
 var a={'Up':'ArrowUp','Down':'ArrowDown','Left':'ArrowLeft','Right':'ArrowRight','Accept':'Enter','Back':'Backspace','BrowserBack':'Backspace'};
 k=a[k]||k;
 if(down&&key[k])return;
 key[k]=down;
 if(!down)return;
 if(screen==='home')return homeInput(k);
 if(screen==='slots')return slotInput(k);
 if(screen==='controls'){if(k==='Enter'||k==='5'||k==='Backspace'||k==='#')screen='home';return;}
 if(screen==='pause'){
  if(k==='2'||k==='ArrowUp')choice=(choice+3)%4;
  else if(k==='8'||k==='ArrowDown')choice=(choice+1)%4;
  else if(k==='5'||k==='Enter'){if(choice===0)screen='play';else if(choice===1){save();notice('World saved');}else if(choice===2){world.mode=world.mode==='survival'?'creative':'survival';notice(world.mode.toUpperCase());}else {save();screen='home';}}
  else if(k==='#'||k==='Backspace')screen='play';return;
 }
 if(screen==='inventory'){
  if(k==='0')menuTab=1-menuTab,menuIndex=0;
  else if(k==='2'||k==='ArrowUp')menuIndex=Math.max(0,menuIndex-1);
  else if(k==='8'||k==='ArrowDown')menuIndex=Math.min((menuTab===0?recipes.length:blockOrder.length)-1,menuIndex+1);
  else if(k==='5'||k==='Enter'){if(menuTab===0)craft();else {selected=menuIndex;screen='play';}}
  else if(k==='*'||k==='#'||k==='Backspace')screen='play';return;
 }
 if(screen!=='play')return;
 if(k==='#'||k==='Backspace'){screen='pause';choice=0;save();}
 else if(k==='*'){screen='inventory';menuTab=0;menuIndex=0;save();}
 else if(k==='1')selected=(selected+blockOrder.length-1)%blockOrder.length;
 else if(k==='3')selected=(selected+1)%blockOrder.length;
 else if(k==='9'){target=(target+1)%3;notice(['Aim front','Aim up','Aim down'][target]);}
 else if(k==='8'||k==='ArrowDown')mine();
 else if(k==='5'||k==='Enter')place();
 else if(k==='7')use();
 else if(k==='0'&&world.mode==='survival'){if(take(5,1)){player.food=Math.min(10,player.food+2);notice('Ate berries (+2)');}else notice('Gather leaves for berries');}
 else if(k==='2'||k==='ArrowUp')jump();
}
document.addEventListener('keydown',function(e){var k=e.key||String(e.keyCode);if(k==='Escape'||k==='SoftRight')k='Backspace';if(k==='SoftLeft')k='*';if(k.indexOf('Arrow')===0||k==='Backspace'||k==='Enter'||k==='#'||k==='*'||(k.length===1&&k>='0'&&k<='9')){e.preventDefault();eventKey(k,true);}},false);
document.addEventListener('keyup',function(e){var k=e.key;if(k==='Escape')k='Backspace';eventKey(k,false);},false);
window.addEventListener('blur',function(){key={};save();});document.addEventListener('visibilitychange',function(){if(document.hidden)save();});
function aim(){var x=player.x+player.face,y=player.y+1;if(target===1){x=player.x;y=player.y-2;}else if(target===2){x=player.x;y=player.y+1;}return{x:x,y:y};}
function mine(){var pos=aim(),t=id(pos.x,pos.y),i;
 if(!t&&target===0){pos.y--;t=id(pos.x,pos.y);}
 for(i=0;i<mobs.length;i++){if(Math.abs(mobs[i].x-player.x)<2){mobs.splice(i,1);world.score+=10;notice('Mob defeated');return;}}
 if(!t){notice('Nothing to mine');return;}
 if(world.mode==='survival'&&hardness[t]>(world.tool===0?1:world.tool+1)){notice('Craft a stronger pick');return;}
 if(setId(pos.x,pos.y,0)){
  if(t===1)give(2,1);else if(t===7)give(7,1);else give(t,1);
  if(t===5&&hash(pos.x,pos.y,world.seed)>.6){give(5,1);notice('Found edible berries');}
  world.score++;saveSoon();
 }
}
function place(){var a=aim(),t=blockOrder[selected];if(id(a.x,a.y)!==0){notice('Space occupied');return;}if((a.x===player.x&&(a.y===player.y||a.y===player.y-1))||!take(t,1)){notice('No blocks / invalid spot');return;}if(!setId(a.x,a.y,t)){give(t,1);return;}saveSoon();}
function use(){var a=aim(),t=id(a.x,a.y);if(t===15){var k=a.x+','+a.y;world.sw[k]=!world.sw[k];notice(world.sw[k]?'Switch ON':'Switch OFF');saveSoon();}else if(world.mode==='survival'){player.food=Math.min(10,player.food+1);notice('Rested (+1 hunger)');}else notice('Aim at a switch');}
function jump(){if(world.mode==='creative'){if(!blocked(player.x,player.y-1))player.y--;return;}if(isSolid(id(player.x,player.y+1))&&!blocked(player.x,player.y-1))player.jump=2;}
function move(dir){player.face=dir;var x=player.x+dir,y=player.y;
 if(blocked(x,y)){
  if(!blocked(x,y-1)&&!isSolid(id(x,y-1))&&!isSolid(id(player.x,player.y-2)))y--;
  else return;
 }
 player.x=x;player.y=y;world.steps++;
 if(world.mode==='survival'&&world.steps%35===0)player.food=Math.max(0,player.food-1);
 saveSoon();
}
function update(now){if(screen!=='play'||!world)return;
 var dt=Math.min((now-lastFrame)||0,200);world.clock+=(dt/1000);lastFrame=now;
 if(now-lastMove>120){if(key['4']||key.ArrowLeft)move(-1);else if(key['6']||key.ArrowRight)move(1);else if(key['2']||key.ArrowUp){if(world.mode==='creative')jump();}else if(key['0']&&world.mode==='creative'){if(!blocked(player.x,player.y+1))player.y++;}lastMove=now;}
 if(now-lastGravity>160){
  if(world.mode==='survival'){
   if(player.jump>0){if(!blocked(player.x,player.y-1))player.y--;player.jump--;}
   else if(!isSolid(id(player.x,player.y+1))&&!blocked(player.x,player.y+1))player.y++;
   if(player.food===0&&Math.floor(world.clock)%8===0&&Math.floor(world.clock)!==Math.floor(world.clock-.16))player.hp--;
   if(player.hp<=0){player.hp=10;player.food=7;player.x=0;player.y=surface(0)-1;world.score=Math.max(0,world.score-30);notice('Respawned at spawn');}
  }lastGravity=now;
 }
 if(now-lastMob>800){updateMobs();lastMob=now;}
 if(now-lastSave>6000)save();
}
function night(){return Math.sin((world.clock%240)/240*Math.PI*2)<-.2;}
function updateMobs(){if(world.mode!=='survival')return;
 if(night()&&mobs.length<3&&hash(Math.floor(world.clock),player.x,world.seed)>.62){var x=player.x+(hash(player.x,Math.floor(world.clock),world.seed)>.5?7:-7);mobs.push({x:x,y:surface(x)-1,hp:2});}
 for(var i=mobs.length-1;i>=0;i--){var m=mobs[i];if(Math.abs(m.x-player.x)>16){mobs.splice(i,1);continue;}
 if(Math.abs(m.x-player.x)<=1&&Math.abs(m.y-player.y)<=2){player.hp=Math.max(0,player.hp-1);notice('Monster attack!');}
 else {m.x+=m.x<player.x?1:-1;m.y=surface(m.x)-1;}
 } }
function sky(){var dark=night(),top=dark?'#101832':'#6eafdd',bot=dark?'#283655':'#b8e9ea';rect(0,0,W,H,top);for(var i=0;i<8;i++)rect(0,i*22,W,22,mixHex(top,bot,i/8));
 var sx=210-Math.floor(world.clock%240)/240*300,sy=62-Math.sin(world.clock/240*Math.PI*2)*48;
 rect(sx,sy,13,13,dark?'#f7f2c8':'#ffe8a6');
 if(dark){for(i=0;i<17;i++){var xx=Math.floor(hash(i,12,world.seed)*W),yy=Math.floor(hash(i,14,world.seed)*130);rect(xx,yy,1+(i%3===0?1:0),2,'#d6e7ff');}}
 for(i=0;i<16;i++){var xx2=i*22-(Math.floor(camX*1.2)%22),hh=35+noise(i*4,5,world.seed)*34;rect(xx2,177-hh,22,hh,dark?'#293d57':'#79a5ac');}
 for(i=0;i<17;i++){var xx3=i*20-(Math.floor(camX*2)%20),hh2=22+noise(i*7,6,world.seed+100)*32;rect(xx3,198-hh2,20,hh2,dark?'#26394b':'#4f8993');}
}
function mixHex(a,b,t){var ar=parseInt(a.slice(1),16),br=parseInt(b.slice(1),16),r=Math.floor(((ar>>16)&255)*(1-t)+((br>>16)&255)*t),g=Math.floor(((ar>>8)&255)*(1-t)+((br>>8)&255)*t),c=Math.floor((ar&255)*(1-t)+(br&255)*t);return 'rgb('+r+','+g+','+c+')';}
function drawTile(t,x,y,wx,wy){if(!t)return;
 var base=colors[t];rect(x,y,16,16,base);
 if(t===1){rect(x,y,16,4,'#86bc52');rect(x,y+3,16,2,'#427d35');}
 else if(t===2){rect(x+2,y+5,3,2,'#a37349');rect(x+10,y+11,4,2,'#65442d');}
 else if(t===3){rect(x+1,y+1,13,3,'#8e989d');rect(x+2,y+7,5,2,'#505b60');rect(x+11,y+12,3,2,'#4b5c63');}
 else if(t===4){rect(x+3,y,3,16,'#bb8550');rect(x+12,y+2,2,11,'#6b402d');}
 else if(t===5){rect(x+2,y+2,12,12,'#55a65d');rect(x+5,y+3,3,2,'#8aca72');}
 else if(t===6){rect(x+2,y+3,4,2,'#f1d796');rect(x+11,y+9,3,2,'#c4a55e');}
 else if(t===7){rect(x,y,16,4,'#ffffff');rect(x+3,y+8,6,2,'#9ebaca');}
 else if(t>=8&&t<=10){rect(x+3,y+4,4,5,t===8?'#1c2428':t===9?'#e3a18b':'#a4edff');rect(x+9,y+10,4,3,t===8?'#252c33':t===9?'#e3a18b':'#c0f4ff');}
 else if(t===11){rect(x,y+6,16,2,'#70472e');rect(x+4,y,2,16,'#efb274');}
 else if(t===12){rect(x+7,y+7,2,9,'#e8c393');rect(x+5,y+1,6,8,'#ffdb57');rect(x+7,y+3,2,4,'#fff1a3');}
 else if(t===13){rect(x+3,y+3,10,10,'#4b4652');rect(x+5,y+9,6,3,'#ff913a');}
 else if(t===14){rect(x+1,y+7,14,3,'#fa7777');rect(x+7,y+2,3,12,'#ffb1ad');}
 else if(t===15){rect(x+4,y+5,9,8,'#77452e');rect(x+8,y+2,2,6,world.sw[wx+','+wy]?'#aaf0a1':'#efcf81');}
 else if(t===16){rect(x+3,y+3,10,10,powered[wx+','+wy]?'#fff5a0':'#71634a');rect(x+5,y+5,6,6,powered[wx+','+wy]?'#fff8d0':'#b7a268');}
 rect(x,y,16,1,'rgba(255,255,255,.12)');rect(x+15,y,1,16,'rgba(0,0,0,.22)');rect(x,y+15,16,1,'rgba(0,0,0,.22)');
}
function tree(x,y,b){var xx=x*TILE-camX,yy=(y-1)*TILE-camY;
 if(xx<-52||xx>W+52||yy<-70||yy>H+40)return;
 var h=b===2?28:45;
 rect(xx+6,yy-h+15,4,h-9,b===2?'#6e6663':'#85542f');
 if(b===1){rect(xx-5,yy-h+8,29,14,'#729c45');rect(xx+1,yy-h+1,19,18,'#9ab65d');}
 else if(b===2){rect(xx-7,yy-h+9,32,13,'#d8ece9');rect(xx+1,yy-h+2,17,13,'#edf9f5');}
 else {rect(xx-7,yy-h+9,30,18,'#2f7851');rect(xx,yy-h,20,20,'#479b5e');rect(xx+3,yy-h+3,9,5,'#6fb978');}
}
function powerNetwork(){powered={};var keys=Object.keys(world.sw),q=[],seen={},i,n;
 for(i=0;i<keys.length;i++)if(world.sw[keys[i]]){var xy=keys[i].split(',');q.push([+xy[0],+xy[1],0]);}
 while(q.length){n=q.shift();if(n[2]>20||Math.abs(n[0]-player.x)>14)continue;var k=n[0]+','+n[1];if(seen[k])continue;seen[k]=true;
 if(id(n[0],n[1])===16)powered[k]=true;
 if(id(n[0],n[1])!==14&&id(n[0],n[1])!==15&&id(n[0],n[1])!==16)continue;
 q.push([n[0]+1,n[1],n[2]+1],[n[0]-1,n[1],n[2]+1],[n[0],n[1]+1,n[2]+1],[n[0],n[1]-1,n[2]+1]);
 }
}
function gameScene(){
 camX=Math.round((player.x+.5)*TILE-W*.5);camY=Math.round((player.y-.1)*TILE-196);
 sky();powerNetwork();
 var minX=Math.floor(camX/TILE)-1,maxX=minX+17,minY=Math.floor(camY/TILE)-1,maxY=minY+22;
 for(var x=minX;x<=maxX;x++){
  var h=surface(x),b=biome(x);
  if(x%6===0&&hash(x,4,world.seed)>.45&&b!==1)tree(x,h,b);
  for(var y=minY;y<=maxY;y++){
   var t=id(x,y);if(t===0)continue;
   // Skip fully buried tiles to keep the low-end CPU work small.
   if(isSolid(id(x,y-1))&&isSolid(id(x+1,y))&&isSolid(id(x-1,y))&&isSolid(id(x,y+1))) {rect(x*TILE-camX,y*TILE-camY,16,16,colors[t]);continue;}
   drawTile(t,x*TILE-camX,y*TILE-camY,x,y);
  }
 }
 var px=player.x*TILE-camX,py=(player.y-1)*TILE-camY;
 rect(px+5,py+3,7,9,'#edcb91');rect(px+4,py+1,9,4,'#513927');rect(px+4,py+12,9,10,'#3b78b1');rect(px+5,py+22,3,9,'#293b5b');rect(px+10,py+22,3,9,'#293b5b');rect(px+(player.face===1?10:4),py+6,2,2,'#232b32');
 for(var j=0;j<mobs.length;j++){var m=mobs[j],mx=m.x*TILE-camX,my=(m.y-1)*TILE-camY;rect(mx+2,my+12,13,16,'#75528f');rect(mx+4,my+8,9,8,'#9a6fbc');rect(mx+5,my+12,3,2,'#ff8b95');rect(mx+11,my+12,3,2,'#ff8b95');}
 var a=aim(),ax=a.x*TILE-camX,ay=a.y*TILE-camY;ctx.strokeStyle='#fff3a2';ctx.lineWidth=2;ctx.strokeRect(ax+1,ay+1,14,14);
 rect(0,0,240,25,'rgba(12,25,36,.84)');drawText('HP '+(world.mode==='creative'?'INF':player.hp)+'/10',7,11,10,'#fa9c92');drawText('FOOD '+(world.mode==='creative'?'INF':player.food)+'/10',87,11,10,'#ffd99c');drawText(night()?'NIGHT':'DAY',228,11,10,night()?'#a7bff8':'#ffec9a','right');
 drawText('X '+player.x+'  '+world.mode.toUpperCase(),7,23,9,'#e4f1fa');
 rect(0,270,240,50,'rgba(13,28,42,.97)');
 var pick=blockOrder[selected];rect(6,276,31,31,'#36556b');drawTile(pick,13,283,0,0);
 drawText(names[pick]+' x'+(world.mode==='creative'?'MAX':item(pick)),44,284,11,'#fff5cb');
 drawText('1/3 item  8 mine  5 place  9 aim',44,297,9,'#b7d8e3');
 drawText('4/6 move  2 jump  * craft  # menu',5,316,9,'#dbeafb');
 if(toast&&Date.now()<toastEnd){rect(0,245,240,19,'rgba(15,34,47,.90)');drawText(toast,120,258,11,'#ffedbc','center');}
}
function drawHome(){rect(0,0,W,H,'#172f48');for(var x=0;x<15;x++)for(var y=0;y<7;y++){var hh=hash(x,y,27);rect(x*16,160+y*16,16,16,hh>.7?'#547d4c':hh>.38?'#785e42':'#51665d');}
 rect(0,0,240,160,'#263f5e');rect(0,120,240,40,'#4e84a4');
 drawText('BLOCK',120,57,33,'#f6f0c4','center');drawText('FRONTIER',120,89,31,'#a2ed9a','center');
 drawText('NOKIA 2720 • KAIOS',120,112,11,'#e5f3ff','center');
 panel(142,167);
 button('NEW WORLD',153,choice===0);button('LOAD WORLD',185,choice===1);button('MODE: '+desiredMode.toUpperCase(),217,choice===2);button('CONTROLS',249,choice===3);
 drawText('2/8 Choose    5 Select',120,304,10,'#d7e9f8','center');}
function drawSlots(){rect(0,0,240,320,'#14283b');drawText(slotAction==='new'?'NEW WORLD':'LOAD WORLD',120,38,20,'#b7e8a2','center');var a=slots();for(var i=0;i<3;i++){var d=a[i],y=68+i*65;rect(13,y,214,54,slotChoice===i?'#4d7c64':'#294557');drawText('SLOT '+(i+1)+' - '+(d?(d.mode||'survival').toUpperCase():'EMPTY'),25,y+20,13,'#ffffff');if(d)drawText('Seed '+d.seed+'  Score '+(d.score||0),25,y+39,10,'#e9e0bb');else drawText('New adventure',25,y+39,10,'#d3e1ee');}
 drawText('2/8 Choose • 5 Open',120,285,10,'#dce8f6','center');drawText('0 Twice = Delete • Back = Menu',120,306,10,'#eacb9a','center');if(toast&&Date.now()<toastEnd)drawText(toast,120,61,10,'#ffdf95','center');}
function drawInventory(){rect(0,0,240,320,'#152b3d');drawText(menuTab===0?'CRAFTING':'INVENTORY',120,26,19,'#e9e7b0','center');drawText('0 = Change tab',120,45,10,'#bcd8e8','center');var arr=menuTab===0?recipes:blockOrder;var st=Math.max(0,menuIndex-6);for(var i=st;i<Math.min(st+7,arr.length);i++){var y=60+(i-st)*29,active=i===menuIndex;rect(10,y,220,26,active?'#557d5c':'#294659');var line='';if(menuTab===0){var r=arr[i];line=r.n+(hasNeed(r)?'  ✓':'  -');}else{line=names[arr[i]]+' x'+item(arr[i]);}drawText(line,17,y+18,12,active?'#fff9c5':'#e6e9e9');}
 if(menuTab===0){var r2=recipes[menuIndex],parts=[];for(var j=0;j<r2.need.length;j++)parts.push(names[r2.need[j][0]]+' '+r2.need[j][1]);drawText(parts.join(' + '),120,281,10,'#f8e5b8','center');}
 drawText('2/8 Scroll • 5 Craft/Select',120,300,10,'#fff1c5','center');drawText('* Close',120,315,10,'#cfdfed','center');}
function drawPause(){gameScene();rect(0,24,240,246,'rgba(8,22,30,.94)');drawText('PAUSED',120,59,22,'#f1e8ba','center');button('RESUME',84,choice===0);button('SAVE WORLD',118,choice===1);button('MODE: '+world.mode.toUpperCase(),152,choice===2);button('MAIN MENU',186,choice===3);drawText('2/8 Select  5 Confirm',120,243,10,'#cfe6ed','center');}
function drawControls(){rect(0,0,240,320,'#163047');drawText('CONTROLS',120,32,20,'#c5edbc','center');var lines=['4 / 6   Walk left / right','2         Jump / fly up','0         Eat / fly down','8         Mine block','5         Place selected block','1 / 3   Previous / next block','9         Aim front / up / down','7         Toggle switch / rest','*         Craft and inventory','#         Pause and save','Autosave every 6 seconds','Offline • Single-player'];for(var i=0;i<lines.length;i++)drawText(lines[i],15,60+i*20,11,'#e6edf6');drawText('5 / Back to menu',120,314,10,'#ffdf9b','center');}
function frame(){var now=Date.now();if(lastRender&&now-lastRender<48){window.requestAnimationFrame(frame);return;}lastRender=now;if(!lastFrame)lastFrame=now;if(screen==='play'&&world){update(now);}else lastFrame=now;
 if(screen==='home')drawHome();else if(screen==='slots')drawSlots();else if(screen==='controls')drawControls();else if(screen==='inventory')drawInventory();else if(screen==='pause')drawPause();else if(screen==='play')gameScene();
 if(window.requestAnimationFrame)window.requestAnimationFrame(frame);else setTimeout(function(){frame(Date.now());},50);
}
window.addEventListener('beforeunload',save);window.requestAnimationFrame(frame);
})();
