"""One-time original sound, score and live particle-system authoring."""
import subprocess,json,pathlib
def run(tool,cfg,*args):subprocess.run([tool,'--config',str(cfg),*map(str,args)],check=True,stdout=subprocess.DEVNULL)
pathlib.Path('/tmp/art').mkdir(exist_ok=True)
pathlib.Path('assets/audio').mkdir(exist_ok=True)
pathlib.Path('assets/fx').mkdir(exist_ok=True)
for i,name in enumerate(['drill','thrust','ore-pickup','material-chime','gas-explosion','lava-sizzle','impact','fabricate','launch','death','alarm-fuel','alarm-core']):
 cfg=pathlib.Path('/tmp/art/audio.json')
 cfg.write_text(json.dumps(dict(sample_rate=22050,channels='mono',max_duration_ms=1800,seed=42+i,actions='/tmp/art/audio.ops.json',preview='/tmp/art/audio.png',wav=str(pathlib.Path('assets/audio')/(name+'.wav')))))
 run('sfx-synth',cfg,'init')
 noisy=name in ['drill','thrust','gas-explosion','lava-sizzle','impact','launch','death']
 dur=1200 if name=='launch' else 500 if noisy else 350
 run('sfx-synth',cfg,'add-voice','--name','body','--wave','noise' if noisy else 'sine','--freq',660+i*45,'--gain',-26 if name in ['drill','thrust'] else -15,'--dur',dur)
 run('sfx-synth',cfg,'add-voice','--name','tone','--wave','triangle','--freq',65 if noisy else 440+i*55,'--gain',-25,'--dur',dur)
 run('sfx-synth',cfg,'set-pitch','--voice','tone','--slide-to',32 if noisy else 880+i*20,'--over',dur)
 run('sfx-synth',cfg,'render')
fx=['gas-seep','drill-debris','jetpack-exhaust','ore-sparkle','material-shimmer','gas-explosion','lava-embers','impact-dust','core-extract','core-detonation','launch-exhaust','death-burst']
for i,name in enumerate(fx):
 cfg=pathlib.Path('/tmp/art/fx.json')
 cfg.write_text(json.dumps(dict(width=400,height=400,duration_ms=1600,fps=30,seed=i+10,actions='/tmp/art/fx.ops.json',preview='/tmp/art/fx.png',system='assets/fx/'+name+'.json')))
 run('particle-2d',cfg,'init')
 seep=name=='gas-seep';big='explosion' in name or 'detonation' in name
 color='#abc6b8' if seep else '#d5b28b' if name in ['drill-debris','impact-dust'] else '#83e4d1' if 'shimmer' in name or 'sparkle' in name else '#ffc482'
 run('particle-2d',cfg,'add-emitter','--name','body','--shape','disc','--radius',30 if seep else 5,'--x',0,'--y',0,'--burst',12 if seep else 180 if name=='core-detonation' else 100 if big else 35,'--lifetime',1300 if seep else 850,'--lifetime-spread',200,'--speed',14 if seep else 520 if name=='core-detonation' else 240 if big else 75,'--speed-spread',10 if seep else 50,'--dir-y',-1 if 'exhaust' in name else 1,'--cone-angle',30 if seep or 'exhaust' in name else 180)
 run('particle-2d',cfg,'set-particle','--emitter','body','--size-from',.5 if seep else 1.7 if big else .6,'--size-to',1.6 if seep else .05,'--opacity-from',.12 if seep else .85,'--opacity-to',0,'--color-gradient',color+'@0,#53616b@1')
 if big:
  run('particle-2d',cfg,'add-emitter','--name','flash','--shape','disc','--radius',1,'--x',0,'--y',0,'--burst',1,'--lifetime',250,'--speed',0)
  run('particle-2d',cfg,'set-particle','--emitter','flash','--size-from',18,'--size-to',0,'--opacity-from',.8,'--opacity-to',0,'--color-gradient','#fff3c0@0,#ff835a@1')
 run('particle-2d',cfg,'render','--frame',12,'--out','/tmp/art/fx.png')
cfg=pathlib.Path('/tmp/art/music.json')
cfg.write_text(json.dumps(dict(sample_rate=22050,channels='stereo',max_duration_ms=24000,seed=63,actions='/tmp/art/music.ops.json',preview='/tmp/art/music.png',wav='assets/audio/music.wav',mid='assets/audio/music.mid')))
run('music',cfg,'init')
run('music',cfg,'set-tempo','--bpm',80)
for track,wave in [('bass','sine'),('air','triangle'),('pulse','sine')]:
 run('music',cfg,'define-track','--name',track,'--instrument',wave)
 run('music',cfg,'set-track-fx','--track',track,'--gain',-24,'--reverb',.35)
for beat in range(32):
 run('music',cfg,'add-note','--track','bass','--pitch',[33,33,29,31][beat//8],'--t',beat,'--dur',.7,'--velocity',55)
 if beat%2==0:run('music',cfg,'add-note','--track','pulse','--pitch',[69,64,67,59,64,62,57,64][beat//2%8],'--t',beat,'--dur',.5,'--velocity',40)
 if beat%8==0:run('music',cfg,'add-note','--track','air','--pitch',[57,53,60,55][beat//8],'--t',beat,'--dur',7.8,'--velocity',45)
run('music',cfg,'render')

# A layered found-metal landing and a bright ore confirmation from the staged pack.
for name,sample,pitch in [('impact','impact_metal_hollow',-7),('ore-pickup','impact_metal_dry',12),('material-chime','impact_metal_hollow',15)]:
 cfg=pathlib.Path('/tmp/art/sample.json')
 cfg.write_text(json.dumps(dict(sample_rate=22050,channels='mono',max_duration_ms=1600,seed=23,actions='/tmp/art/sample.ops.json',preview='/tmp/art/sample.png',wav='assets/audio/'+name+'.wav',sample_pack='combat-core')))
 run('sfx-sample',cfg,'init')
 run('sfx-sample',cfg,'add-sample','--name',sample,'--t',0,'--gain',-17,'--pitch',pitch,'--fade-out',180)
 run('sfx-sample',cfg,'add-voice','--name','undertone','--wave','sine','--freq',75 if name=='impact' else 880,'--gain',-26,'--dur',350)
 run('sfx-sample',cfg,'render')
