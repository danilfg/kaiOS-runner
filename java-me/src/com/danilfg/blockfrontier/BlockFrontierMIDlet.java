package com.danilfg.blockfrontier;

import javax.microedition.midlet.MIDlet;
import javax.microedition.lcdui.Canvas;
import javax.microedition.lcdui.Display;
import javax.microedition.lcdui.Font;
import javax.microedition.lcdui.Graphics;
import javax.microedition.rms.RecordStore;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;

/**
 * Block Frontier Java ME: tiny 2D single-player sandbox for old Nokia phones.
 * CLDC 1.0 / MIDP 2.0. No web runtime, internet, or external libraries.
 * The older Nokia 2720 fold supports MIDP; 2019 KaiOS Flip needs an emulator.
 */
public final class BlockFrontierMIDlet extends MIDlet {
    private WorldScreen screen;

    public void startApp() {
        if (screen == null) screen = new WorldScreen(this);
        Display.getDisplay(this).setCurrent(screen);
        screen.resumeLoop();
    }

    public void pauseApp() { if (screen != null) screen.save(); }
    public void destroyApp(boolean unconditional) { if (screen != null) screen.close(); }

    void quitGame() {
        if (screen != null) screen.close();
        notifyDestroyed();
    }

    private static final class WorldScreen extends Canvas implements Runnable {
        private static final int MENU=0, PLAY=1, CRAFT=2, PAUSE=3;
        private static final int AIR=0, GRASS=1, DIRT=2, STONE=3, WOOD=4;
        private static final int LEAF=5, SAND=6, ORE=7, PLANK=8, TORCH=9;
        private static final int SNOW=10, WIRE=11, LAMP=12, WATER=13;
        private static final int MAX_EDITS=420, WORLD_BOTTOM=36;
        private static final int[] PICKABLE={DIRT,STONE,WOOD,PLANK,TORCH,WIRE,LAMP,SAND};
        private static final String[] NAMES={"Air","Grass","Dirt","Stone","Wood","Leaf","Sand","Ore","Plank","Torch","Snow","Wire","Lamp","Water"};
        private static final int[] COLORS={0,0x61b943,0x895533,0x777986,0x86502b,0x3a9e54,0xd1ba72,0x567b91,0x9b633c,0xe5ab40,0xe3f1f2,0x8f73ad,0xf6d14e,0x459ac8};
        private final BlockFrontierMIDlet app;
        private final Font font = Font.getFont(Font.FACE_SYSTEM,Font.STYLE_PLAIN,Font.SIZE_SMALL);
        private Thread loop;
        private boolean running;
        private int state=MENU, slot=0, seed=1543, px=4, py=10, face=1;
        private int health=100, hunger=100, tick=0, mode=0, selected=0, aim=0, recipe=0, pick=0, jumps=0;
        private int enemyX,enemyY,enemyHP, craftNotice=0, deleteSlot=-1, noticeTimer=0;
        private String notice="";
        private int[] inventory=new int[14];
        private int[] editX=new int[MAX_EDITS],editY=new int[MAX_EDITS],editV=new int[MAX_EDITS];
        private int edits=0;
        private int frame=0, tile=12, viewX=0, viewY=0;
        private int sky=0x80c8ed;

        WorldScreen(BlockFrontierMIDlet owner) {
            this.app=owner;
            setFullScreenMode(true);
        }
        synchronized void resumeLoop() {
            if (running) return;
            running=true;
            loop=new Thread(this);
            loop.start();
        }
        synchronized void close() {
            save();
            running=false;
        }
        public void run() {
            while (running) {
                try { Thread.sleep(250); } catch (InterruptedException ignored) {}
                if (state==PLAY) step();
                repaint();
            }
        }

        private int mix(int x,int y) {
            int n=x*374761393+y*668265263+seed*97;
            n=(n^(n>>>13))*1274126177;
            return (n^(n>>>16)) & 0x7fffffff;
        }
        private int floorDiv(int x,int n) {
            return x>=0 ? x/n : (x+1)/n-1;
        }
        private int biome(int x) { return mix(floorDiv(x,44),75)%4; }
        private int ground(int x) {
            int c=floorDiv(x,5);
            int g=15+(mix(c,24)%5)+(mix(floorDiv(x,16),28)%4)-3;
            if(g<10)g=10;
            if(g>22)g=22;
            return g;
        }
        private int baseTile(int x,int y) {
            if(y<0) return AIR;
            if(y>=WORLD_BOTTOM) return STONE;
            int h=ground(x);
            int b=biome(x);
            if(y>=h) {
                if(y==h) return b==2?SAND:b==3?SNOW:GRASS;
                if(y<h+3) return b==2?SAND:DIRT;
                if(y>h+4 && mix(floorDiv(x,2),floorDiv(y,2))%14==0) return AIR;
                if(y>h+5 && mix(x,y)%23==0) return ORE;
                return STONE;
            }
            if(b==0 || b==1) {
                int i;
                for(i=x-2;i<=x+2;i++) {
                    if((i%15+15)%15 != 4 || biome(i)>1) continue;
                    int top=ground(i)-4;
                    if(x==i && y>=top+1 && y<=top+3) return WOOD;
                    if(y>=top-1 && y<=top+1 && (x-i)*(x-i)+(y-top)*(y-top)<=5) return LEAF;
                }
            }
            return AIR;
        }
        private int get(int x,int y) {
            int i;
            for(i=edits-1;i>=0;i--) if(editX[i]==x && editY[i]==y)return editV[i];
            return baseTile(x,y);
        }
        private void put(int x,int y,int value) {
            if(y<0||y>=WORLD_BOTTOM) return;
            int i;
            for(i=edits-1;i>=0;i--) if(editX[i]==x && editY[i]==y) {
                editV[i]=value; return;
            }
            if(edits>=MAX_EDITS) {
                message("Build limit reached"); return;
            }
            editX[edits]=x; editY[edits]=y; editV[edits]=value;
            edits++;
        }
        private boolean solid(int b) {
            return b!=AIR && b!=WATER && b!=TORCH && b!=WIRE;
        }
        private boolean canStand(int x,int y) {
            return !solid(get(x,y)) && !solid(get(x,y-1));
        }
        private void startNew(int s) {
            slot=s;
            seed=(int)(System.currentTimeMillis() % 1048576L)+77+s*103;
            px=3; py=ground(px)-1; face=1;
            health=100;hunger=100;tick=0; selected=0;aim=0;pick=0;edits=0;
            enemyHP=0;inventory=new int[14];
            inventory[WOOD]=4;inventory[DIRT]=8;inventory[PLANK]=4;
            state=PLAY;message("World "+(slot+1)+" created");
            save();
        }
        private String storeName(int s) {return "BFME"+s;}
        private boolean exists(int s) {
            RecordStore r=null;
            try {
                r=RecordStore.openRecordStore(storeName(s),false);
                return r.getNumRecords()>0;
            } catch (Exception ignored) {return false;}
            finally {if(r!=null)try{r.closeRecordStore();}catch(Exception ignored){}}
        }
        private boolean load(int s) {
            RecordStore r=null;
            try {
                r=RecordStore.openRecordStore(storeName(s),false);
                if(r.getNumRecords()<1) return false;
                byte[] raw=r.getRecord(1);
                DataInputStream d=new DataInputStream(new ByteArrayInputStream(raw));
                if(d.readInt()!=0x42464d31) return false;
                seed=d.readInt();px=d.readInt();py=d.readInt();
                health=d.readInt();hunger=d.readInt();tick=d.readInt();
                mode=d.readInt();pick=d.readInt();
                int i,n=d.readInt();
                if(n!=14) return false;
                for(i=0;i<n;i++) inventory[i]=d.readInt();
                n=d.readInt();
                if(n<0 || n>MAX_EDITS) return false;
                edits=n;
                for(i=0;i<n;i++) {editX[i]=d.readInt();editY[i]=d.readInt();editV[i]=d.readInt();}
                slot=s;enemyHP=0;state=PLAY;
                message("World "+(s+1)+" loaded");
                return true;
            } catch (Exception ignored) {return false;}
            finally {if(r!=null)try{r.closeRecordStore();}catch(Exception ignored){}}
        }
        synchronized void save() {
            if(state==MENU) return;
            RecordStore r=null;
            try {
                ByteArrayOutputStream buf=new ByteArrayOutputStream(6400);
                DataOutputStream d=new DataOutputStream(buf);
                d.writeInt(0x42464d31); d.writeInt(seed);d.writeInt(px);d.writeInt(py);
                d.writeInt(health);d.writeInt(hunger);d.writeInt(tick);
                d.writeInt(mode);d.writeInt(pick);d.writeInt(14);
                int i;
                for(i=0;i<inventory.length;i++)d.writeInt(inventory[i]);
                d.writeInt(edits);
                for(i=0;i<edits;i++) {d.writeInt(editX[i]);d.writeInt(editY[i]);d.writeInt(editV[i]);}
                d.flush();
                byte[] data=buf.toByteArray();
                r=RecordStore.openRecordStore(storeName(slot),true);
                if(r.getNumRecords()==0)r.addRecord(data,0,data.length);
                else r.setRecord(1,data,0,data.length);
            } catch (Exception ex) { message("Save failed"); }
            finally {if(r!=null)try{r.closeRecordStore();}catch(Exception ignored){}}
        }
        private void erase(int s) {
            try {RecordStore.deleteRecordStore(storeName(s));}catch(Exception ignored){}
        }
        private void message(String s){notice=s;noticeTimer=24;}

        private void step() {
            frame++;
            tick++;
            if(mode==0) {
                if(tick%50==0 && hunger>0)hunger--;
                if(tick%45==0 && hunger==0)health-=3;
                if(health<=0) {
                    health=100;hunger=65;px=3;py=ground(px)-1;enemyHP=0;
                    message("Respawned!");
                }
            }
            if(jumps>0) {
                if(canStand(px,py-1)) {py--;jumps--;}
                else jumps=0;
            } else if(mode==0 && !solid(get(px,py+1)) && canStand(px,py+1)) {
                py++;
            }
            if(mode==0 && isNight() && enemyHP==0 && tick%45==0) {
                enemyX=px+(face*5); enemyY=ground(enemyX)-1;enemyHP=3;
            }
            if(enemyHP>0) {
                if(!isNight())enemyHP=0;
                else if(tick%3==0) {
                    if(enemyX<px)enemyX++;
                    else if(enemyX>px)enemyX--;
                    enemyY=ground(enemyX)-1;
                    if(enemyX==px && Math.abs(enemyY-py)<3) {
                        health-=3;
                        if(health<0)health=0;
                    }
                }
            }
            if(tick%24==0)save();
            if(noticeTimer>0)noticeTimer--;
        }
        private boolean isNight() {return tick%240>138;}
        private void move(int dx) {
            face=dx;
            if(canStand(px+dx,py))px+=dx;
            else if(canStand(px+dx,py-1) && !solid(get(px,py-1))) {
                py--;px+=dx;
            }
        }
        private int aimX(){return px+(aim==0?face:0);}
        private int aimY(){return py+(aim==1?1:aim==2?-1:0);}
        private void dig() {
            int x=aimX(),y=aimY(),v=get(x,y);
            if(enemyHP>0 && Math.abs(x-enemyX)<2 && Math.abs(y-enemyY)<2) {
                enemyHP-=pick>0?2:1;
                if(enemyHP<=0) {inventory[ORE]++;message("Mob defeated");}
                return;
            }
            if(v==AIR || v==WATER || y>=WORLD_BOTTOM-1)return;
            if(v==STONE || v==ORE) {
                if(pick==0 && (tick%3==0)){message("Craft a pickaxe");return;}
            }
            if(v==GRASS || v==SNOW)v=DIRT;
            if(v==LEAF){ if(mix(x,y)%3==0)inventory[WOOD]++; }
            else if(v==SAND || v==ORE || v==STONE || v==WOOD || v==DIRT || v==PLANK || v==TORCH || v==WIRE || v==LAMP) inventory[v]++;
            put(x,y,AIR);
            if(edits%9==0)save();
        }
        private void place() {
            int x=aimX(),y=aimY(),v=PICKABLE[selected];
            if(x==px && (y==py || y==py-1))return;
            if(get(x,y)!=AIR && get(x,y)!=WATER)return;
            if(mode==1 || inventory[v]>0) {
                put(x,y,v);
                if(mode==0)inventory[v]--;
            } else message("Need "+NAMES[v]);
        }
        private void craft() {
            if(mode==1){message("Creative: all blocks");return;}
            boolean ok=false;
            if(recipe==0 && inventory[WOOD]>=1){
                inventory[WOOD]--;inventory[PLANK]+=4;ok=true;
            }
            if(recipe==1 && inventory[PLANK]>=2 && inventory[WOOD]>=1) {
                inventory[PLANK]-=2;inventory[WOOD]--;pick=1;ok=true;
            }
            if(recipe==2 && inventory[WOOD]>=1 && inventory[STONE]>=1) {
                inventory[WOOD]--;inventory[STONE]--;inventory[TORCH]+=3;ok=true;
            }
            if(recipe==3 && inventory[ORE]>=1) {
                inventory[ORE]--;inventory[WIRE]+=4;ok=true;
            }
            if(recipe==4 && inventory[ORE]>=2 && inventory[STONE]>=1) {
                inventory[ORE]-=2;inventory[STONE]--;inventory[LAMP]++;ok=true;
            }
            message(ok?"Crafted!":"Not enough items");
            if(ok)save();
        }
        protected void keyPressed(int k) {handleKey(k);}
        protected void keyRepeated(int k) {handleKey(k);}
        private synchronized void handleKey(int k) {
            int act=0;
            try{act=getGameAction(k);}catch(Exception ignored){}
            if(state==MENU) {
                if(k=='4' || act==LEFT){slot=(slot+2)%3;deleteSlot=-1;}
                else if(k=='6' || act==RIGHT){slot=(slot+1)%3;deleteSlot=-1;}
                else if(k=='2' || k=='8' || act==UP || act==DOWN)mode=1-mode;
                else if(k=='0'){
                    if(deleteSlot==slot){erase(slot);deleteSlot=-1;message("Deleted!");}
                    else {deleteSlot=slot;message("Press 0 again");}
                }
                else if(k=='5' || act==FIRE){
                    int newMode=mode;
                    if(!exists(slot) || !load(slot)) {
                        startNew(slot);mode=newMode;
                    }
                } else if(k=='#' || k==-7)app.quitGame();
            } else if(state==PLAY) {
                if(k=='4' || act==LEFT)move(-1);
                else if(k=='6' || act==RIGHT)move(1);
                else if(k=='2' || act==UP){
                    if(mode==1){if(canStand(px,py-1))py--;}
                    else if(solid(get(px,py+1)))jumps=2;
                } else if(k=='0'){
                    if(mode==1){if(canStand(px,py+1))py++;}
                    else if(inventory[WOOD]>0 && hunger<100){
                        inventory[WOOD]--;hunger+=15;if(hunger>100)hunger=100;message("Food +15");
                    }
                } else if(k=='8' || act==DOWN)dig();
                else if(k=='5' || act==FIRE)place();
                else if(k=='1')selected=(selected+PICKABLE.length-1)%PICKABLE.length;
                else if(k=='3')selected=(selected+1)%PICKABLE.length;
                else if(k=='9')aim=(aim+1)%3;
                else if(k=='7'){if(get(aimX(),aimY())==WIRE)put(aimX(),aimY(),LAMP);}
                else if(k=='*' || k==-6)state=CRAFT;
                else if(k=='#' || k==-7){save();state=PAUSE;}
            } else if(state==CRAFT) {
                if(k=='2' || act==UP)recipe=(recipe+4)%5;
                else if(k=='8' || act==DOWN)recipe=(recipe+1)%5;
                else if(k=='5' || act==FIRE)craft();
                else if(k=='*' || k=='#' || k==-6 || k==-7){state=PLAY;save();}
            } else if(state==PAUSE) {
                if(k=='#' || k=='5' || act==FIRE)state=PLAY;
                else if(k=='0'){save();state=MENU;}
                else if(k=='2' || k=='8'){mode=1-mode;message(mode==1?"Creative":"Survival");save();}
            }
            repaint();
        }

        protected synchronized void paint(Graphics g) {
            int w=getWidth(),h=getHeight();
            g.setFont(font);
            if(state==MENU){drawMenu(g,w,h);return;}
            if(state==CRAFT){drawCraft(g,w,h);return;}
            if(state==PAUSE){drawPause(g,w,h);return;}
            drawWorld(g,w,h);
        }
        private void fill(Graphics g,int color,int x,int y,int w,int h) {
            g.setColor(color);g.fillRect(x,y,w,h);
        }
        private void text(Graphics g,String s,int x,int y,int color) {
            g.setColor(color);g.drawString(s,x,y,Graphics.TOP|Graphics.LEFT);
        }
        private void center(Graphics g,String s,int y,int color,int w) {
            int sw=font.stringWidth(s);
            text(g,s,(w-sw)/2,y,color);
        }
        private void drawMenu(Graphics g,int w,int h) {
            fill(g,0x132a37,0,0,w,h);
            int i;
            for(i=0;i<35;i++) {
                int x=mix(i,20)%w, y=mix(i,21)%h;
                fill(g,i%3==0?0x4f8191:0x34515e,x,y,2,2);
            }
            center(g,"BLOCK FRONTIER",12,0xf6dc78,w);
            center(g,"JAVA ME / OFFLINE",29,0xe0e9ec,w);
            center(g,"+----------------+",48,0x7ab39e,w);
            for(i=0;i<3;i++) {
                String status=exists(i)?"SAVE":"NEW";
                String label=(i==slot?">":" ")+"World "+(i+1)+" "+status;
                center(g,label,64+i*17,i==slot?0xffff77:0xe6e6e6,w);
            }
            center(g,mode==0?"Mode: Survival":"Mode: Creative",h-39,0xa4f0a4,w);
            center(g,"4/6:slot 2/8:mode",h-26,0xc3d0d1,w);
            center(g,"5:play 0:delete",h-14,0xc3d0d1,w);
        }
        private void drawWorld(Graphics g,int w,int h) {
            tile=w<180?12:16;
            int cols=w/tile+2,rows=(h-27)/tile+2;
            viewX=px-cols/2;
            viewY=py-rows/2;
            boolean night=isNight();
            sky=night?0x12233f:0x83c7e6;
            fill(g,sky,0,0,w,h);
            if(night){
                int j;
                for(j=0;j<23;j++){
                    int sx=mix(j,3)%w,sy=mix(j,44)%(h-20);
                    fill(g,j%2==0?0xc2cbe6:0x697eaa,sx,sy,1,1);
                }
            } else {
                fill(g,0xffd15b,w-30,27,10,10);
                fill(g,0xffffff,w-74,46,21,4);
                fill(g,0xedfbfb,w-65,42,24,5);
            }
            int cx,cy,v,sx,sy;
            for(cy=viewY;cy<viewY+rows;cy++) {
                for(cx=viewX;cx<viewX+cols;cx++) {
                    v=get(cx,cy);
                    if(v==AIR)continue;
                    sx=(cx-viewX)*tile;
                    sy=14+(cy-viewY)*tile;
                    if(sx>=w || sy>=h-13 || sx+tile<0 || sy+tile<14)continue;
                    paintBlock(g,v,sx,sy,tile,cx,cy,night);
                }
            }
            if(enemyHP>0 && night){
                sx=(enemyX-viewX)*tile;
                sy=14+(enemyY-viewY)*tile;
                fill(g,0x62356a,sx+2,sy+2,tile-4,tile-2);
                fill(g,0xf1abc8,sx+3,sy+4,2,2);
                fill(g,0xf1abc8,sx+tile-6,sy+4,2,2);
            }
            sx=(px-viewX)*tile;
            sy=14+(py-viewY)*tile;
            fill(g,0x5a3232,sx+3,sy-8,tile-6,8);
            fill(g,0xf3c69e,sx+3,sy-6,tile-6,5);
            fill(g,0x385fa8,sx+2,sy+2,tile-4,tile-4);
            fill(g,0x1e3049,sx+2,sy+tile-3,3,3);
            fill(g,0x1e3049,sx+tile-5,sy+tile-3,3,3);
            int ax=(aimX()-viewX)*tile;
            int ay=14+(aimY()-viewY)*tile;
            g.setColor(0xf9e48a);g.drawRect(ax,ay,tile-1,tile-1);
            fill(g,0x142533,0,0,w,14);
            text(g,(night?"N":"D")+" HP"+health+" F"+hunger+" X"+px,2,1,0xffffff);
            fill(g,0x182c38,0,h-14,w,14);
            String desc=NAMES[PICKABLE[selected]]+" "+(mode==1?"INF":String.valueOf(inventory[PICKABLE[selected]]));
            text(g,desc,2,h-13,0xf4dc8c);
            text(g,"*Bag #Menu",w-69,h-13,0xf3f3f3);
            if(noticeTimer>0) {
                fill(g,0x22313b,0,h-29,w,14);
                center(g,notice,h-28,0xf5dc77,w);
            }
        }
        private void paintBlock(Graphics g,int b,int x,int y,int t,int wx,int wy,boolean night) {
            int color=COLORS[b];
            fill(g,color,x,y,t,t);
            if(b==GRASS || b==DIRT || b==STONE || b==SAND || b==SNOW || b==PLANK) {
                fill(g,0xffffff & (color+0x111111),x,y,t,2);
                fill(g,0x343434,x+t-2,y+2,2,t-2);
                if(b==GRASS){fill(g,0x4b9c35,x,y,t,3);fill(g,0x77d14c,x+2,y,3,2);}
                if(b==STONE){fill(g,0x505666,x+t/3,y+t/2,t/3,2);}
                if(b==PLANK){fill(g,0x684025,x,y+t/2,t,1);}
                if(b==SNOW){fill(g,0xf7ffff,x,y,t,4);}
            } else if(b==WOOD) {
                fill(g,0x5a331d,x+2,y,2,t);
                fill(g,0xb58142,x+t-4,y,2,t);
                fill(g,0xcf9e51,x+4,y+3,t-8,1);
            } else if(b==LEAF) {
                fill(g,0x2c703e,x+1,y+2,t-2,t-3);
                fill(g,0x6dcb78,x+3,y+2,t/2,3);
            } else if(b==ORE) {
                fill(g,0x374b62,x+1,y+1,t-2,t-2);
                fill(g,0x8be2ef,x+3,y+3,t/3,t/3);
            } else if(b==TORCH || b==LAMP) {
                fill(g,0xfff5a5,x+3,y+2,t-6,t-5);
                fill(g,0xeeaa32,x+t/2-1,y+3,2,t-5);
            } else if(b==WIRE) {
                fill(g,0x4b5266,x,y+t/2,t,2);
                fill(g,0xdbb55b,x+t/2-1,y+t/2-2,2,5);
            } else if(b==WATER) {
                fill(g,0x66bddc,x,y+3,t,t-3);
            }
            if(night && b!=LAMP && b!=TORCH) {
                g.setColor(0x081d36);
                g.drawLine(x,y+t-1,x+t-1,y+t-1);
            }
        }
        private void drawCraft(Graphics g,int w,int h) {
            fill(g,0x172b36,0,0,w,h);
            center(g,"INVENTORY & CRAFT",5,0xf5d481,w);
            text(g,"Wood "+inventory[WOOD]+"  Stone "+inventory[STONE],5,23,0xe4e4e4);
            text(g,"Ore "+inventory[ORE]+"  Dirt "+inventory[DIRT],5,36,0xe4e4e4);
            text(g,pick==0?"Tool: hands":"Tool: pickaxe",5,49,0x9ee2bc);
            String[] opts={"Planks  1 Wood","Pickaxe  2P+1W","Torch  1W+1S","Wire   1 Ore","Lamp   2O+1S"};
            int i;
            for(i=0;i<5;i++) {
                text(g,(i==recipe?"> ":"  ")+opts[i],5,63+i*15,i==recipe?0xfbe77a:0xc7dbe1);
            }
            center(g,"2/8:choose 5:craft",h-25,0xd1e3e7,w);
            center(g,"*:return",h-13,0xd1e3e7,w);
            if(noticeTimer>0)center(g,notice,h-38,0xf5dc77,w);
        }
        private void drawPause(Graphics g,int w,int h) {
            fill(g,0x193044,0,0,w,h);
            center(g,"PAUSED / SAVED",h/2-52,0xffdf88,w);
            center(g,"5: Continue",h/2-26,0xffffff,w);
            center(g,"2: Change mode",h/2-10,0xffffff,w);
            center(g,mode==1?"CREATIVE":"SURVIVAL",h/2+8,0x96dfb0,w);
            center(g,"0: World selection",h/2+26,0xffffff,w);
            center(g,"#: Resume",h/2+45,0xe6e6e6,w);
        }
    }
}
