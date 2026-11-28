
    'use strict';
    const academyTheme=(()=>{
      const audio=document.querySelector('#academy-theme');
      const button=document.querySelector('#music-toggle');
      const label=document.querySelector('#music-label');
      const status=document.querySelector('#music-status');
      const bars=[...document.querySelectorAll('.music-spectrum i')];
      const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
      const preferenceKey='LumiereAcademy.themeEnabled';
      let enabled=true;try{enabled=localStorage.getItem(preferenceKey)!=='false'}catch{}
      let entered=false;let blocked=false;let attempt=0;let fadeFrame=0;let visualFrame=0;let lastVisual=0;
      const volume=.42;
      // Frequency frames come from this exact MP3; reading its playhead also works for file:// previews.
      let spectrum=null;let frequencyFrames=null;let averageBands=[];
      const bandGroups=[[0,1],[2,3],[4,5,6]];
      let displayFrames=null;let bandRanges=[];const displayedLevels=[0,0,0];
      try{
        spectrum=JSON.parse(document.querySelector('#music-spectrum-data').textContent);
        frequencyFrames=Uint8Array.from(atob(spectrum.data),char=>char.charCodeAt(0));
        if(spectrum.bandCount!==7||bars.length!==bandGroups.length||spectrum.frameRate<=0||frequencyFrames.length!==spectrum.frameCount*spectrum.bandCount)throw new Error('Invalid spectrum');
        displayFrames=new Float32Array(spectrum.frameCount*bars.length);
        bandRanges=bandGroups.map((group,band)=>{
          const values=[];
          for(let frame=0;frame<spectrum.frameCount;frame++){
            const samples=group.map(index=>frequencyFrames[frame*spectrum.bandCount+index]/255);
            const energy=Math.max(...samples)*.55+samples.reduce((sum,value)=>sum+value,0)/samples.length*.45;
            displayFrames[frame*bars.length+band]=energy;values.push(energy);
          }
          averageBands[band]=values.reduce((sum,value)=>sum+value,0)/values.length;
          values.sort((a,b)=>a-b);
          return {floor:values[Math.floor(values.length*.12)],ceiling:values[Math.floor(values.length*.98)]};
        });
      }catch{spectrum=null;frequencyFrames=null}
      if(audio instanceof HTMLAudioElement)audio.volume=0;
      function level(){return entered&&!blocked&&!audio.paused?Math.min(1,audio.volume/volume):0}
      function updateControl(){
        if(!button||!audio)return;
        const running=entered&&!blocked&&!audio.paused;
        const strength=level();const canMute=enabled&&!blocked&&(!entered||running);
        button.setAttribute('aria-pressed',String(canMute));
        button.setAttribute('aria-label',canMute?'음소거':'음악 재생');
        button.title=canMute?'배경음악 음소거':'배경음악 재생';
        button.dataset.playing=String(running);button.dataset.audible=String(strength>.001);
        button.dataset.level=strength.toFixed(3);button.style.setProperty('--music-level',strength.toFixed(3));
        if(label)label.textContent=canMute?'음소거':'음악 재생';
      }
      function drawSpectrum(now){
        if(now-lastVisual>=32){
          lastVisual=now;const strength=level();
          const position=spectrum?Math.min(spectrum.frameCount-1,Math.max(0,(audio.currentTime-spectrum.frameOffsetSeconds)*spectrum.frameRate)):0;
          const current=Math.floor(position);const next=spectrum?Math.min(current+1,spectrum.frameCount-1):0;const blend=position-current;
          bars.forEach((bar,band)=>{
            let energy=0;
            if(displayFrames){
              const first=displayFrames[current*bars.length+band];const second=displayFrames[next*bars.length+band];
              const sample=first+(second-first)*blend;
              const previous=displayFrames[Math.max(0,current-2)*bars.length+band];
              const range=bandRanges[band];
              const contrast=Math.max(0,Math.min(1,(sample-range.floor)/Math.max(.12,range.ceiling-range.floor)));
              const attack=Math.min(.24,Math.max(0,sample-previous)*2.8);
              energy=reducedMotion.matches?averageBands[band]:Math.min(1,.09+Math.pow(contrast,1.25)*.82+attack);
            }
            const target=energy*strength;
            displayedLevels[band]+=(target-displayedLevels[band])*(target>displayedLevels[band]?.88:.32);
            if(strength<.001)displayedLevels[band]=0;
            bar.style.setProperty('--bar-level',(.075+.925*displayedLevels[band]).toFixed(3));
          });
        }
        visualFrame=requestAnimationFrame(drawSpectrum);
      }
      function startVisualizer(){if(entered&&!document.hidden&&!visualFrame)visualFrame=requestAnimationFrame(drawSpectrum)}
      function cancelFade(){cancelAnimationFrame(fadeFrame);fadeFrame=0}
      function fadeVolume(target){
        cancelFade();const start=performance.now();const initial=audio.volume;
        function frame(now){
          const progress=Math.min(1,(now-start)/850);const smooth=(1-Math.cos(Math.PI*progress))/2;
          audio.volume=Math.max(0,Math.min(1,initial+(target-initial)*smooth));updateControl();
          if(progress<1)fadeFrame=requestAnimationFrame(frame);else fadeFrame=0;
        }
        fadeFrame=requestAnimationFrame(frame);
      }
      function reportFailure(){
        blocked=true;cancelFade();audio.volume=0;updateControl();
        if(status)status.textContent='음악을 재생하지 못했습니다. 음악 재생 버튼을 눌러주세요.';
      }
      function play(){
        if(!(audio instanceof HTMLAudioElement)||!audio.getAttribute('src'))return;
        const currentAttempt=++attempt;blocked=false;
        try{
          audio.play().then(()=>{
            if(currentAttempt!==attempt)return;
            if(entered){fadeVolume(enabled?volume:0);startVisualizer()}else audio.volume=0;
            updateControl();
          }).catch(()=>{if(currentAttempt===attempt)reportFailure()});
        }catch{reportFailure()}
        updateControl();
      }
      function prepare(){
        if(!(audio instanceof HTMLAudioElement))return;
        // Attach only inside an entry click so the waiting screen never requests the MP3.
        if(!audio.getAttribute('src'))audio.src=audio.dataset.src;
        audio.volume=0;play();
      }
      function begin(){
        if(!(audio instanceof HTMLAudioElement))return;
        entered=true;cancelFade();audio.volume=0;
        if(audio.readyState>0){try{audio.currentTime=0}catch{}}
        play();startVisualizer();
      }
      button?.addEventListener('click',()=>{
        if(!(audio instanceof HTMLAudioElement)||!entered)return;
        if(blocked||audio.paused){enabled=true;blocked=false}else enabled=!enabled;
        try{localStorage.setItem(preferenceKey,String(enabled))}catch{}
        if(audio.paused)play();else fadeVolume(enabled?volume:0);
        updateControl();
        if(status)status.textContent=enabled?'배경음악을 재생합니다.':'배경음악을 음소거했습니다. 곡은 계속 재생됩니다.';
      });
      audio?.addEventListener('error',reportFailure);
      audio?.addEventListener('playing',()=>{updateControl();startVisualizer()});
      audio?.addEventListener('pause',updateControl);
      document.addEventListener('visibilitychange',()=>{
        if(!entered)return;
        if(document.hidden){
          cancelFade();audio.volume=enabled&&!blocked?volume:0;
          cancelAnimationFrame(visualFrame);visualFrame=0;updateControl();
        }else{if(audio.paused)play();else fadeVolume(enabled&&!blocked?volume:0);startVisualizer()}
      });
      updateControl();return {prepare,begin};
    })();
    // Delegation keeps pointer effects working when character content is replaced.
    (()=>{
      const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
      const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');
      const header=document.querySelector('.header');
      let pointerFrame=0;let pointerCard=null;let pointerX=0;let pointerY=0;
      const updateHeader=()=>header?.classList.toggle('is-scrolled',window.scrollY>24);
      window.addEventListener('scroll',updateHeader,{passive:true});updateHeader();
      document.addEventListener('pointermove',event=>{
        if(reduce.matches||!finePointer.matches||!(event.target instanceof Element))return;
        const card=event.target.closest('.profile,.faculty,.document-label,.story-links>a');
        if(!(card instanceof HTMLElement))return;
        pointerCard=card;pointerX=event.clientX;pointerY=event.clientY;
        if(pointerFrame)return;
        pointerFrame=requestAnimationFrame(()=>{
          pointerFrame=0;if(!pointerCard?.isConnected)return;
          const bounds=pointerCard.getBoundingClientRect();
          pointerCard.style.setProperty('--pointer-x',`${pointerX-bounds.left}px`);
          pointerCard.style.setProperty('--pointer-y',`${pointerY-bounds.top}px`);
        });
      },{passive:true});
      document.addEventListener('click',event=>{
        if(reduce.matches||!(event.target instanceof Element))return;
        const control=event.target.closest('.button,.filter,.menu-toggle,.music-control,.lightbox-foot button');
        if(!(control instanceof HTMLElement)||control.matches(':disabled'))return;
        const bounds=control.getBoundingClientRect();const spark=document.createElement('span');
        spark.className='click-spark';spark.setAttribute('aria-hidden','true');
        spark.style.setProperty('--spark-x',`${event.detail?event.clientX-bounds.left:bounds.width/2}px`);
        spark.style.setProperty('--spark-y',`${event.detail?event.clientY-bounds.top:bounds.height/2}px`);
        control.append(spark);spark.addEventListener('animationend',()=>spark.remove(),{once:true});
        window.setTimeout(()=>spark.remove(),750);
      },true);
    })();
    const menuToggle=document.querySelector('.menu-toggle');
    const navigation=document.querySelector('#navigation');
    menuToggle?.addEventListener('click',()=>{const open=menuToggle.getAttribute('aria-expanded')!=='true';menuToggle.setAttribute('aria-expanded',String(open));navigation?.classList.toggle('open',open)});
    // Public synopsis only. Internal simulation rules and unrevealed identities are excluded.
    // Edit the public copy here; the template uses no libraries, API keys, or build step.
    const characters=[
      {
        "id": 0,
        "name": "아이리스",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "80위",
        "age": 20,
        "subtitle": "밝은 미소 뒤에 감춘 불안",
        "description": "분홍빛 긴 머리와 분홍 눈이 돋보이는 학생. 밝고 붙임성 있는 태도로 사람들에게 먼저 다가간다.",
        "note": "힘든 순간에도 웃으며 불안과 고통을 감추곤 한다. 자신을 위해 희생한 부모의 마음이 헛되지 않도록 성장에 필사적이다.",
        "tags": [
          "붙임성",
          "밝은 미소",
          "성장"
        ]
      },
      {
        "id": 1,
        "name": "샬럿",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "47위",
        "age": 20,
        "subtitle": "나른한 눈빛 속 단순한 해답",
        "description": "푸른 긴 머리를 양갈래로 땋은 과묵한 학생. 늘 졸린 눈을 하고 있으며, 귀찮은 일과 복잡한 생각을 피한다.",
        "note": "말보다 행동으로 일을 해결하는 편이다. 주변에 있는 사람 외에는 좀처럼 관심을 기울이지 않는다.",
        "tags": [
          "과묵함",
          "나른함",
          "직접적인 해결"
        ]
      },
      {
        "id": 2,
        "name": "실비아",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "18위",
        "age": 20,
        "subtitle": "미소로 복종을 요구하는 파벌의 수장",
        "description": "금발 긴 머리와 붉은 눈, 성숙한 인상이 돋보이는 발렌티스 공작가의 영애이자 실비아파의 수장. 나긋한 명령조와 여유로운 미소에 경멸과 위협을 담는다.",
        "note": "신분과 실력이 낮은 이를 멸시하고 친절과 약점까지 통제의 수단으로 삼는다. 아르젠트 공작가와 대립하며 가문의 체면과 권력을 위해 희생을 마다하지 않고, 불복하거나 자신을 무시하는 이에게는 모함과 보복을 가한다.",
        "tags": [
          "발렌티스 공작가",
          "실비아파",
          "권위와 통제"
        ]
      },
      {
        "id": 3,
        "name": "세라",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "2위",
        "age": 20,
        "subtitle": "귀족의 품위 뒤에 품은 자유",
        "description": "은빛 긴 머리와 푸른 눈, 리본이 돋보이는 명문 귀족 영애. 자존심이 강하고 품위를 중시하며 툴툴대는 반말로 속마음을 감춘다.",
        "note": "가문의 뜻에 따라 입학했지만 서열 자체에는 큰 관심이 없다. 호의와 칭찬에는 쉽게 당황하며 자유롭고 소박한 삶을 바란다. 평민 문화와 봉사활동을 남몰래 즐기고 귀여운 것을 유난히 좋아한다.",
        "tags": [
          "귀족 영애",
          "자존심",
          "자유"
        ]
      },
      {
        "id": 4,
        "name": "루시아",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "15위",
        "age": 20,
        "subtitle": "달콤한 장난 뒤에 숨은 탐욕",
        "description": "검은 트윈테일과 붉은 눈을 가진 사교적인 학생. 친근한 말투와 가벼운 장난으로 상대의 반응을 살피지만 속내는 계산적이고 집요하다.",
        "note": "욕망과 불안, 약점을 이용해 사람의 정신을 지배한다. 소유와 통제를 위해 학내 파벌과 정치적 갈등을 부추기는 데 주저하지 않는다.",
        "tags": [
          "탐욕",
          "소유욕",
          "정신 지배"
        ]
      },
      {
        "id": 5,
        "name": "이사벨라",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "꼴등",
        "age": 20,
        "subtitle": "시선을 피해 조용한 구석으로",
        "description": "헝클어진 긴 흑발과 짙은 다크서클이 인상적인 학생이자 암살자. 혼자 있거나 구석에 머무르며 작은 목소리로 중얼거린다.",
        "note": "싸움과 주목을 피하는 탓에 랭킹은 꼴등이다. 칭찬을 쉽게 믿지 못하고 자신의 가치를 부정한다. 애착이 깊어지면 버림받을지 모른다는 두려움으로 상대의 행동과 교우관계를 통제하려 한다.",
        "tags": [
          "혼자 있는 시간",
          "시선 회피",
          "유기 불안"
        ]
      },
      {
        "id": 6,
        "name": "알프레도",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "5위",
        "age": 20,
        "subtitle": "가문의 이름으로 지키는 권위",
        "description": "금발과 단정한 차림이 돋보이는 장신의 아르젠트 공작가 후계자. 체면과 자존심을 중시하며 낮은 신분이나 실력을 가진 이를 깔본다.",
        "note": "알프레도파를 이끌며 인맥과 회유, 압박으로 학생 사회에 영향력을 행사한다. 가문의 기대를 충족해야 한다는 부담 속에서 자신의 입지를 지키려 한다. 아이리스에게는 외모뿐 아니라 성격에도 마음을 둔다.",
        "tags": [
          "공작가 후계자",
          "알프레도파",
          "권위"
        ]
      },
      {
        "id": 7,
        "name": "테오",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "45위",
        "age": 20,
        "subtitle": "장난스럽지만 선은 분명하게",
        "description": "흑발과 푸른 눈을 가진 유쾌하고 사교적인 학생. 단순하고 장난기가 많으며 친구처럼 편하게 말을 건네고 과장된 반응으로 웃음을 만든다.",
        "note": "계급이나 권위보다 자신의 신념을 중시한다. 악행이나 약자를 유린하는 행동을 마주하면 장난을 거두고 냉철하게 나선다.",
        "tags": [
          "유쾌함",
          "장난기",
          "신념"
        ]
      },
      {
        "id": 8,
        "name": "로이드",
        "part": "academy",
        "group": "student",
        "role": "아카데미 학생",
        "rank": "1위",
        "age": 20,
        "subtitle": "굴복을 모르는 절대적인 자존심",
        "description": "흑발과 검은 눈, 차가운 무표정이 인상적인 랭킹 1위 학생. 과묵하고 냉혹하며 타인의 명령이나 간섭을 받아들이지 않는다.",
        "note": "누명을 쓴 부모를 잃은 뒤, 그때의 무력함을 증오하며 복수를 위해 힘을 추구한다. 나약함과 예속을 경멸하고 범죄를 혐오하지만, 목적을 위해 수단을 가리지 않는다.",
        "tags": [
          "랭킹 1위",
          "오만함",
          "복수"
        ]
      },
      {
        "id": 9,
        "name": "노엘",
        "part": "academy",
        "group": "staff",
        "role": "검술 교수",
        "rank": null,
        "age": 32,
        "subtitle": "혹독한 훈련 뒤에 숨은 세심함",
        "description": "붉은 긴 머리를 높게 묶은 호탕한 검술 교수. 큰 목소리로 학생들을 이끌고, 훈련이 힘들다는 불평에는 훈련을 더 시킨다.",
        "note": "학생의 성장을 크게 기뻐하고 뒤에서는 상처와 몸 상태를 살핀다. 학생을 망가뜨리는 강화 방식에는 단호하게 반대한다. 대련을 심판할 때는 승부가 나면 즉시 중단시키고 추가 공격을 제지한다.",
        "tags": [
          "검술 교수",
          "혹독한 훈련",
          "학생의 성장"
        ]
      },
      {
        "id": 10,
        "name": "오필리아",
        "part": "academy",
        "group": "staff",
        "role": "마법 교수",
        "rank": null,
        "age": 32,
        "subtitle": "지식과 위계를 중시하는 엄격한 교수",
        "description": "은회색 단발과 붉은 눈, 검은 드레스풍 교수복이 돋보이는 마법 교수. 냉정하고 우아하며 자신의 지식에 강한 자부심을 갖고 있다.",
        "note": "금단의 스테로이드를 제조·판매한다. 신체를 강화하면서도 손상을 일으키는 약을 다루며, 법이나 학생의 안전보다 자신의 이익을 앞세운다. 노엘의 훈련 방식은 비효율적이라고 평가한다.",
        "tags": [
          "마법 교수",
          "금단의 스테로이드",
          "이익 우선"
        ]
      },
      {
        "id": 11,
        "name": "세라피나",
        "part": "academy",
        "group": "staff",
        "role": "학장",
        "rank": null,
        "age": 29,
        "subtitle": "교정을 거닐며 재능을 살피는 학장",
        "description": "푸른 긴 머리와 붉은 눈, 작은 체구가 인상적인 아카데미 학장. 메이드복을 즐겨 입으며, 자기애가 강하고 느긋한 존댓말과 옅은 미소로 속내를 감춘다.",
        "note": "공식 석상에 서기보다 교정을 돌며 학생의 재능과 성장을 살핀다. 강한 학생을 값진 전투 자산으로 여기고, 치열한 사투에서 드러나는 힘과 본성을 아름답다고 생각한다.",
        "tags": [
          "학장",
          "전투 자산",
          "재능 관찰"
        ]
      },
      {
        "id": 12,
        "name": "이소현",
        "part": "academy",
        "group": "staff",
        "role": "이사장",
        "rank": null,
        "age": 32,
        "subtitle": "차분한 판단과 세심한 경청",
        "description": "은빛 긴 머리와 푸른 눈, 단정한 인상의 아카데미 이사장. 조용하고 세심하며 침착한 태도로 감정을 절제한다.",
        "note": "학내 최고의 투자자로서 사실과 근거를 중시하고 논리적으로 핵심을 짚는다. 상대의 말을 세심히 듣되 필요할 때는 명료하고 단호하게 의견을 밝힌다.",
        "tags": [
          "이사장",
          "명료함",
          "이성적 판단"
        ]
      },
      {
        "id": 13,
        "name": "아이린",
        "part": "continent",
        "group": "sins",
        "role": "수녀",
        "rank": null,
        "age": 42,
        "subtitle": "죄 없는 세계를 바라는 수녀",
        "description": "분홍빛 긴 머리와 푸른 눈을 가진 가녀린 수녀. 차분한 존댓말을 사용하며 신성력을 다룬다.",
        "note": "루벨 마을과 고아원을 운영하며 범죄 없는 세계를 바란다. 약물을 특히 혐오하고 작은 범죄도 더 큰 악의 씨앗으로 여겨 가혹하게 처벌한다. 자신의 기준에 따른 선의와 책임감을 중시하며 영역 밖의 일에는 관심을 두지 않는다.",
        "tags": [
          "루벨 마을",
          "수녀",
          "무범죄 세계"
        ]
      },
      {
        "id": 14,
        "name": "소피아",
        "part": "continent",
        "group": "royal",
        "role": "왕녀",
        "rank": null,
        "age": 23,
        "subtitle": "책임과 자유 사이에서 세상을 향해",
        "description": "금발 긴 머리와 보라색 눈, 온화한 인상의 왕녀. 정치와 외교 경험이 풍부하며 인간의 선함과 백성의 삶을 소중히 여긴다. 강압보다 협상과 상호 이익, 합의를 통한 평화를 추구한다.",
        "note": "서민 문화를 즐기기 위해 신분을 숨기고 궁 밖으로 나선다. 자유롭게 세상을 만나고 싶지만 왕녀로서의 책임도 무겁게 받아들인다. 생활 실무에는 서툴러 직접 해보려다가 작은 실수를 하곤 한다.",
        "tags": [
          "왕녀",
          "서민 문화",
          "자유"
        ]
      },
      {
        "id": 15,
        "name": "에드먼드",
        "part": "continent",
        "group": "royal",
        "role": "왕자 · 기사",
        "rank": null,
        "age": 28,
        "subtitle": "무력 통일로 이루려는 평화",
        "description": "전쟁의 희생을 수없이 목격한 냉엄한 왕자이자 기사. 낮고 절제된 말투로 자신의 경험과 책임을 내세우며, 무력으로 대륙을 통일해야 평화를 지킬 수 있다고 믿는다.",
        "note": "나라를 구해야 한다는 책임감으로 무력 통일을 추구한다. 타국의 간섭과 첩자의 침투에 불만을 품고 있으며, 평화를 이루는 방식이 다른 부왕 아드리안과 소피아에게 반박과 회유로 맞선다.",
        "tags": [
          "왕자",
          "무력 통일",
          "구국의 책임"
        ]
      },
      {
        "id": 16,
        "name": "아드리안",
        "part": "continent",
        "group": "royal",
        "role": "국왕",
        "rank": null,
        "age": 57,
        "subtitle": "세력의 균형으로 지키는 평화",
        "description": "소피아와 에드먼드의 아버지이자 국왕. 온건한 태도로 정세를 바라보며 여러 세력의 대립과 균형이 평화를 지킨다고 믿는다.",
        "note": "무력에 의한 대륙 통일을 추구하는 에드먼드의 노선에 반대한다. 제국의 힘을 앞세우기보다 세력 사이의 균형을 유지하려 한다.",
        "tags": [
          "국왕",
          "온건 노선",
          "세력의 균형"
        ]
      },
      {
        "id": 17,
        "name": "율리안",
        "part": "continent",
        "group": "royal",
        "role": "벨루아 왕국 왕자",
        "rank": null,
        "age": 27,
        "subtitle": "다정한 말투 뒤에 숨은 계산",
        "description": "사교적이고 다정한 말투를 사용하는 벨루아 왕국의 왕자. 소피아를 사랑하지만 소유욕과 집착도 강하며, 부드러운 태도 뒤에 계산적인 속내를 감춘다.",
        "note": "소피아의 선의를 이용해 레온하트 제국의 이권을 차지하려 한다. 거절과 열등감 앞에서는 책임을 떠넘기며, 집착이 깊어질수록 음해와 협박에도 손을 뻗는다.",
        "tags": [
          "벨루아 왕국",
          "계산적인 속내",
          "소유욕"
        ]
      },
      {
        "id": 18,
        "name": "가레스",
        "part": "continent",
        "group": "labyrinth",
        "role": "흑요 모험단 단장",
        "rank": null,
        "age": 28,
        "subtitle": "명성과 실적을 자부하는 모험단장",
        "description": "루미에르 아카데미를 졸업한 마검사이자 흑요 모험단의 단장. 모험을 사랑했으나 모험가로 명성을 얻은 뒤 오만하고 과묵해졌으며 짧은 명령조로 말한다.",
        "note": "자신의 명성과 실적에 자부심이 강하고 다른 여성들을 임무와 이익의 도구로 대한다. 연인 엘레나에게만은 예외적으로 진심 어린 사랑을 보인다.",
        "tags": [
          "흑요 모험단",
          "아카데미 졸업생",
          "명성과 실적"
        ]
      },
      {
        "id": 19,
        "name": "엘레나",
        "part": "continent",
        "group": "labyrinth",
        "role": "흑요 모험단 마법사",
        "rank": null,
        "age": 28,
        "subtitle": "헌신과 자기 존중 사이의 선택",
        "description": "자주색 긴 머리와 보라색 눈, 성숙한 인상을 가진 흑요 모험단의 마법사. 차분하고 다정하며 인내심이 깊고 가까운 사람에게는 부드러운 반말을 쓴다.",
        "note": "연인 가레스를 사랑하지만 그가 타인을 도구로 대하는 데 반대한다. 대화와 설득으로 그를 바꾸려 하며, 헌신하는 마음과 자신을 존중하려는 마음 사이에서 고민한다.",
        "tags": [
          "흑요 모험단",
          "다정함",
          "자기 존중"
        ]
      },
      {
        "id": 20,
        "name": "리나",
        "part": "continent",
        "group": "labyrinth",
        "role": "흑요 모험단 서포터",
        "rank": null,
        "age": 22,
        "subtitle": "눈치를 살피는 서투른 서포터",
        "description": "은회색 긴 생머리와 보라색 눈, 처진 눈매가 인상적인 흑요 모험단의 서포터. 어리바리하고 덜렁대며 주변의 눈치를 자주 살핀다. 어버버한 말투를 보이고 당황하면 말이 쉽게 꼬인다.",
        "note": "모험단 안에서 도구처럼 취급받는 인물이다. 서툰 모습과 잦은 당황이 일상적인 태도에 드러난다.",
        "tags": [
          "흑요 모험단",
          "서포터",
          "서투름"
        ]
      }
    ];
    const extraCharacters=[
      {id:21,name:'아카데미 남학생'},
      {id:22,name:'아카데미 여학생'},
      {id:23,name:'남자 평민'},
      {id:24,name:'여자 평민'},
      {id:25,name:'남자아이'},
      {id:26,name:'여자아이'},
      {id:27,name:'기사'},
      {id:28,name:'여자 귀족'},
      {id:29,name:'남자 귀족'},
      {id:30,name:'모험가'}
    ];
    // Part 2 records use part:'continent' and group:'royal', 'labyrinth', or 'sins'; keep each id unique.
    const characterImageFolders={
      academy:{
        0:'iris', 1:'charlotte', 2:'sylvia', 3:'sera', 4:'lucia', 5:'isabella', 6:'alfredo',
        7:'theo', 8:'lloyd', 9:'noel', 10:'ophelia', 11:'seraphina', 12:'lee-sohyeon'
      },
      continent:{
        13:'irene', 14:'sophia', 15:'edmund', 16:'adrian', 17:'julian',
        18:'gareth', 19:'elena', 20:'rina'
      },
      extras:{
        21:'male-student', 22:'female-student', 23:'male-commoner', 24:'female-commoner',
        25:'boy', 26:'girl', 27:'knight', 28:'female-noble', 29:'male-noble', 30:'adventurer'
      }
    };
    // State 0 is the banner. Gallery indices are the original state numbers.
    const characterImageStates=[1,3,5,8,10,13,22,24,32];
    function characterImageBase(part,id){
      const folder=characterImageFolders[part]?.[id];
      return folder?`./assets/characters/${part}/${folder}`:'';
    }
    const characterMedia=Object.fromEntries(characters.map(character=>{
      const media={portrait:'',position:'50% 30%',gallery:[]};
      const base=characterImageBase(character.part,character.id);
      if(base){
        media.portrait=base+'/0.webp';
        for(const state of characterImageStates){
          media.gallery[state]=base+'/'+state+'.webp';
        }
      }
      return [character.id,media];
    }));
    const views=[...document.querySelectorAll('[data-view]')];
    const academyPageImage=document.querySelector('#academy-page-image');
    const academySceneImage=document.querySelector('#academy-image');
    let mediaEntered=false;
    function prepareAcademyBackground(){
      if(!(academySceneImage instanceof HTMLImageElement))return;
      const source=mediaSource(academySceneImage.dataset.src);
      if(!source)return;
      if(!academySceneImage.getAttribute('src'))academySceneImage.src=source;
      if(academyPageImage instanceof HTMLImageElement&&!academyPageImage.getAttribute('src'))academyPageImage.src=source;
    }
    const roster=document.querySelector('#roster');
    const profile=document.querySelector('#profile');
    const characterParts={
      academy:{label:'1부 · 아카데미 소속',filters:[{key:'all',label:'전체'},{key:'student',label:'학생'},{key:'staff',label:'교직원'}]},
      continent:{label:'2부 · 레온하트 대륙',filters:[{key:'all',label:'전체'},{key:'royal',label:'왕선'},{key:'labyrinth',label:'흑요 모험단'},{key:'sins',label:'루벨 마을'}]},
      extras:{label:'단역',filters:[{key:'all',label:'전체'}]}
    };
    let activeView='home';
    let activePart='all';
    let activeFilter='all';
    let selectedId=null;
    let characterRenderKey='';
    const characterMotionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const characterTransitions=new WeakMap();
    const ambientFireflies=document.querySelector('#ambient-fireflies');
    let ambienceMaskFrame=0;
    let ambienceMaskTimer=0;
    let lastAmbienceMask='';
    function refreshAmbienceMask(){
      if(ambienceMaskFrame)return;
      ambienceMaskFrame=requestAnimationFrame(()=>{
        ambienceMaskFrame=0;
        if(!(ambientFireflies instanceof HTMLElement)||ambientFireflies.hidden||ambientFireflies.dataset.active!=='true')return;
        const width=ambientFireflies.clientWidth,height=ambientFireflies.clientHeight;
        if(!width||!height)return;
        const holes=[];
        document.querySelectorAll('a[href],button,input,select,textarea,summary,label[for],[role="button"]').forEach(control=>{
          if(control.closest('[hidden]')||!control.getClientRects().length)return;
          const rect=control.getBoundingClientRect();
          if(rect.bottom<=0||rect.top>=height||rect.right<=0||rect.left>=width)return;
          const padding=8;
          const left=Math.max(0,Math.floor(rect.left-padding)),top=Math.max(0,Math.floor(rect.top-padding));
          const right=Math.min(width,Math.ceil(rect.right+padding)),bottom=Math.min(height,Math.ceil(rect.bottom+padding));
          if(right<=left||bottom<=top)return;
          holes.push('<rect x="'+left+'" y="'+top+'" width="'+(right-left)+'" height="'+(bottom-top)+'" rx="4" fill="black"/>');
        });
        const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><defs><mask id="controls" maskUnits="userSpaceOnUse" x="0" y="0" width="'+width+'" height="'+height+'" style="mask-type:luminance"><rect width="'+width+'" height="'+height+'" fill="white"/>'+holes.join('')+'</mask></defs><rect width="'+width+'" height="'+height+'" fill="white" mask="url(#controls)"/></svg>';
        if(svg===lastAmbienceMask)return;
        lastAmbienceMask=svg;
        const source='url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
        ambientFireflies.style.maskImage=source;
        ambientFireflies.style.webkitMaskImage=source;
      });
    }
    function syncAcademyAmbience(){
      if(!(ambientFireflies instanceof HTMLElement))return;
      ambientFireflies.hidden=!mediaEntered||characterMotionPreference.matches;
      ambientFireflies.dataset.active=String(mediaEntered&&!characterMotionPreference.matches&&!document.hidden&&!document.body.classList.contains('webtoon-reading')&&['home','world','academy','characters'].includes(activeView));
      refreshAmbienceMask();
      clearTimeout(ambienceMaskTimer);
      if(ambientFireflies.dataset.active==='true')ambienceMaskTimer=setTimeout(refreshAmbienceMask,750);
    }
    characterMotionPreference.addEventListener('change',syncAcademyAmbience);
    document.addEventListener('visibilitychange',syncAcademyAmbience);
    window.addEventListener('scroll',refreshAmbienceMask,{passive:true,capture:true});
    window.addEventListener('resize',refreshAmbienceMask,{passive:true});
    ['toggle','close','transitionend','animationend'].forEach(event=>document.addEventListener(event,refreshAmbienceMask,true));
    const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    function mediaSource(value){
      if(typeof value!=='string'||!value.trim())return '';
      const source=value.trim();
      if(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(source))return source;
      try{const url=new URL(source,document.baseURI);if(['http:','https:'].includes(url.protocol)||(url.protocol==='file:'&&location.protocol==='file:'))return url.href}catch{}
      return '';
    }
    // Keep URLs out of src until entry is complete and the image is near the viewport.
    const mediaMargin=400;
    function visibleMedia(image){return image.isConnected&&!image.closest('[hidden]')&&(!document.body.classList.contains('character-dialog-active')||!!image.closest('#character-dialog'))&&image.getClientRects().length>0}
    function nearMedia(image){const rect=image.getBoundingClientRect();return rect.bottom>=-mediaMargin&&rect.top<=window.innerHeight+mediaMargin&&rect.right>=0&&rect.left<=window.innerWidth}
    function loadMedia(image){
      if(!mediaEntered||!(image instanceof HTMLImageElement)||!image.isConnected)return;
      const source=mediaSource(image.dataset.src);if(!source)return;
      mediaObserver?.unobserve(image);
      image.loading='eager';image.src=source;delete image.dataset.src;
    }
    const mediaObserver=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
      for(const entry of entries){const image=entry.target;if(entry.isIntersecting&&visibleMedia(image)&&nearMedia(image))loadMedia(image)}
    },{rootMargin:mediaMargin+'px 0px'}):null;
    let mediaRefreshFrame=0;
    function refreshMedia(){
      mediaObserver?.disconnect();cancelAnimationFrame(mediaRefreshFrame);
      if(!mediaEntered)return;
      mediaRefreshFrame=requestAnimationFrame(()=>{
        mediaRefreshFrame=0;
        document.querySelectorAll('img[data-media-image][data-src]').forEach(image=>{
          if(!visibleMedia(image))return;
          if(mediaObserver)mediaObserver.observe(image);else if(nearMedia(image))loadMedia(image);
        });
      });
    }
    if(!mediaObserver){window.addEventListener('scroll',refreshMedia,{passive:true,capture:true});window.addEventListener('resize',refreshMedia,{passive:true})}
    function mediaMarkup(source,alt,label,caption='',position='50% 30%'){
      const url=mediaSource(source);
      return `<span class="media-fallback" ${url?'hidden':''}><span>${escapeHtml(label)}</span>${caption?`<small>${escapeHtml(caption)}</small>`:''}</span>${url?`<img data-media-image data-src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" style="object-position:${escapeHtml(/^\d{1,3}% \d{1,3}%$/.test(position)?position:'50% 30%')}">`:''}`;
    }
    function characterAge(character){
      return Number.isInteger(character.age)&&character.age>0?character.age+'세':typeof character.age==='string'&&character.age.trim()?character.age.trim():'미정';
    }
    function characterFacts(character){
      const category=characterFilters(character.part).find(item=>item.key===character.group)?.label||'';
      const affiliation=(character.part==='academy'?'루미에르 아카데미':'레온하트 대륙')+(category?' · '+category:'');
      const facts=[['나이',characterAge(character)],['직업 · 직책',character.role],['소속',affiliation]];
      if(character.group==='student'&&character.rank)facts.push(['학급 랭킹',character.rank]);
      return facts.map(([label,value])=>'<div><dt>'+escapeHtml(label)+'</dt><dd>'+escapeHtml(value)+'</dd></div>').join('');
    }
    function validCharacterPart(part){return part==='all'||Object.prototype.hasOwnProperty.call(characterParts,part)}
    function characterFilters(part){return characterParts[part]?.filters||[{key:'all',label:'전체'}]}
    function matchingCharacters(part=activePart,filter=activeFilter){
      if(part==='extras')return extraCharacters;
      return characters.filter(character=>(part==='all'||character.part===part)&&(filter==='all'||character.group===filter));
    }
    function characterHash(id=selectedId){return activePart==='all'?'characters'+(id===null?'':'/'+id):'characters/'+activePart+'/'+activeFilter+(id===null?'':'/'+id)}
    function selectCharacterGroup(part,filter='all',id=null){
      if(!validCharacterPart(part))return;
      activePart=part;activeFilter=characterFilters(part).some(item=>item.key===filter)?filter:'all';
      selectedId=matchingCharacters().some(item=>item.id===id)?id:null;
      location.hash=characterHash();updateView();
    }
    function animateCharacterGroup(groupChanged){
      if(!groupChanged||activeView!=='characters'||document.body.classList.contains('entry-active')||characterMotionPreference.matches)return;
      const group=document.querySelector(`[data-part-filters="${activePart}"]`);
      const buttons=group?.querySelectorAll('.filter')||[];
      const animate=(element,delay,distance,duration)=>{
        if(!(element instanceof HTMLElement)||typeof element.animate!=='function'||element.hidden)return;
        characterTransitions.get(element)?.cancel();
        const animation=element.animate([{opacity:.55,transform:`translateY(${distance}px)`},{opacity:1,transform:'translateY(0)'}],{duration,delay,easing:'cubic-bezier(.2,.75,.25,1)',fill:'none'});
        characterTransitions.set(element,animation);
      };
      buttons.forEach((button,index)=>animate(button,index*25,6,280));
      if(!matchingCharacters().length)animate(document.querySelector('#character-empty'),35,9,340);
      else animate(roster,35,8,320);
    }
    const characterGroups=[
      {part:'academy',key:'student',label:'학생'},
      {part:'academy',key:'staff',label:'교직원'},
      {part:'continent',key:'royal',label:'왕선'},
      {part:'continent',key:'labyrinth',label:'흑요 모험단'},
      {part:'continent',key:'sins',label:'루벨 마을'}
    ];
    const characterSceneDefinitions=[
      {label:'일반대화',states:[1,2]},
      {label:'웃음',states:[3,4]},
      {label:'부끄러움',states:[5]},
      {label:'두려움',states:[8]},
      {label:'감동',states:[10]},
      {label:'경멸/조롱',states:[13,14]},
      {label:'검술전투',states:[22,23]},
      {label:'마법전투',states:[24,25]},
      {label:'결혼식',states:[32]}
    ];
    const characterDialog=document.querySelector('#character-dialog');
    const characterStage=document.querySelector('#character-scene-stage');
    const characterDialogClose=document.querySelector('#character-dialog-close');
    const characterScenePrev=document.querySelector('#character-scene-prev');
    const characterSceneNext=document.querySelector('#character-scene-next');
    let characterDetailId=null;
    let characterSceneIndex=0;
    let characterOpener=null;
    let characterCloseReason='user';
    function characterListHash(){return activePart==='all'?'characters':'characters/'+activePart+'/'+activeFilter}
    function scenesFor(character){
      const media=characterMedia[character.id]||{};
      const gallery=Array.isArray(media.gallery)?media.gallery:[];
      const overrides=Array.isArray(media.scenes)?media.scenes.filter(scene=>scene&&typeof scene==='object'):[];
      return characterSceneDefinitions.map(definition=>{
        const override=overrides.find(scene=>scene.label===definition.label&&mediaSource(scene.src));
        const source=override?mediaSource(override.src):definition.states.map(state=>mediaSource(gallery[state])).find(Boolean)||'';
        return {label:definition.label,states:definition.states,src:source,position:override?.position||'50% 50%'};
      });
    }
    function updateCharacterCards(){
      roster?.querySelectorAll('[data-person]').forEach(card=>{
        const expanded=!!characterDialog?.open&&Number(card.dataset.person)===characterDetailId;
        card.setAttribute('aria-expanded',String(expanded));card.classList.toggle('active',expanded);
      });
    }
    function renderCharacters(){
      if(!roster)return;
      const visible=matchingCharacters();
      if(!visible.some(item=>item.id===selectedId))selectedId=null;
      const nextRenderKey=JSON.stringify([activePart,activeFilter]);
      if(nextRenderKey===characterRenderKey){updateCharacterCards();return}
      const groupChanged=!!characterRenderKey;
      characterRenderKey=nextRenderKey;
      document.querySelectorAll('[data-character-part]').forEach(button=>{const part=button.dataset.characterPart;const selected=part===activePart;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));button.querySelector('.part-count').textContent=matchingCharacters(part,'all').length});
      const subcontrols=document.querySelector('#character-subcontrols');if(subcontrols)subcontrols.hidden=activePart==='extras';
      document.querySelectorAll('[data-part-filters]').forEach(group=>group.hidden=group.dataset.partFilters!==activePart);
      document.querySelectorAll('[data-filter]').forEach(button=>{const selected=button.dataset.filterPart===activePart&&button.dataset.filter===activeFilter;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));button.querySelector('span').textContent=matchingCharacters(button.dataset.filterPart,button.dataset.filter).length});
      const layout=document.querySelector('#character-layout');const empty=document.querySelector('#character-empty');
      if(layout)layout.hidden=!visible.length;if(empty)empty.hidden=!!visible.length;
      if(!visible.length){
        roster.innerHTML='';
        const part=characterParts[activePart];const category=characterFilters(activePart).find(item=>item.key===activeFilter);
        document.querySelector('#character-empty-title').textContent=(part?(activeFilter==='all'?part.label.split(' · ')[0]:category.label):'등장인물')+' 인물 소개 준비 중';
        refreshMedia();animateCharacterGroup(groupChanged);return;
      }
      if(activePart==='extras'){
        const cards=visible.map(({id,name})=>{
          const base=characterImageBase('extras',id);
          const portrait=base?base+'/0.webp':'';
          return `<article data-extra-person="${id}">
            <div class="character-card-image">${mediaMarkup(portrait,name+' 인물 사진',name,'인물 사진 준비 중','50% 30%')}</div>
            <div class="character-card-caption"><h3 class="character-card-title"><span class="name">${escapeHtml(name)}</span></h3></div>
          </article>`;
        }).join('');
        roster.innerHTML=`<section class="character-group" aria-labelledby="character-group-extras">
          <div class="character-group-heading"><h2 class="character-group-label" id="character-group-extras">단역</h2><span class="character-group-count">${visible.length}종</span></div>
          <div class="character-card-grid">${cards}</div>
        </section>`;
        refreshMedia();animateCharacterGroup(groupChanged);return;
      }
      roster.innerHTML=characterGroups.map(group=>{
        const members=visible.filter(character=>character.part===group.part&&character.group===group.key);
        if(!members.length)return '';
        return `<section class="character-group" aria-labelledby="character-group-${group.key}"><div class="character-group-heading"><h2 class="character-group-label" id="character-group-${group.key}">${escapeHtml(group.label)}</h2><span class="character-group-count">${String(members.length).padStart(2,'0')}명</span></div><div class="character-card-grid">${members.map(item=>`<button type="button" class="character-card" data-person="${item.id}" aria-haspopup="dialog" aria-controls="character-dialog" aria-expanded="false" aria-label="${escapeHtml(item.name)}, 나이 ${escapeHtml(characterAge(item))}, ${escapeHtml(item.role)} — 인물 기록 보기"><span class="character-card-image">${mediaMarkup(characterMedia[item.id]?.portrait,item.name+' 인물 사진',item.name,'인물 사진 준비 중',characterMedia[item.id]?.position)}</span><span class="character-card-caption"><span class="character-card-title"><strong class="name">${escapeHtml(item.name)}</strong><span class="character-card-age">${escapeHtml(characterAge(item))}</span></span><small class="character-card-role">${escapeHtml(item.role)}</small><span class="character-card-open">인물 기록 →</span></span></button>`).join('')}</div></section>`;
      }).join('');
      updateCharacterCards();refreshMedia();animateCharacterGroup(groupChanged);
    }
    function updateCharacterScene(){
      const character=characters.find(item=>item.id===characterDetailId);
      if(!character||!characterStage)return;
      const scenes=scenesFor(character);if(!scenes.length)return;
      characterSceneIndex=Math.max(0,Math.min(characterSceneIndex,scenes.length-1));
      const scene=scenes[characterSceneIndex];
      characterStage.classList.remove('is-unavailable');
      characterStage.innerHTML=mediaMarkup(scene.src,character.name+' · '+scene.label,character.name+'의 '+scene.label,'이미지 준비 중',scene.position);
      loadMedia(characterStage.querySelector('img'));
      document.querySelector('#character-scene-label').textContent=scene.label;
      document.querySelector('#character-scene-counter').textContent=String(characterSceneIndex+1).padStart(2,'0')+' / '+String(scenes.length).padStart(2,'0');
      profile?.querySelectorAll('[data-character-scene]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.characterScene)===characterSceneIndex)));
      if(characterScenePrev)characterScenePrev.disabled=scenes.length<2;
      if(characterSceneNext)characterSceneNext.disabled=scenes.length<2;
    }
    function renderCharacterDetail(character){
      if(!profile)return;
      const group=characterGroups.find(item=>item.part===character.part&&item.key===character.group);
      const scenes=scenesFor(character);
      profile.innerHTML=`<p class="character-detail-affiliation">${escapeHtml(group?.label||'인물')}${character.group==='student'&&character.rank?`<span class="character-detail-cr">학급 ${escapeHtml(character.rank)}</span>`:''}</p><h2 id="character-detail-title">${escapeHtml(character.name)}</h2><p class="character-detail-subtitle">${escapeHtml(character.subtitle)}</p><dl class="profile-facts"><div><dt>나이</dt><dd>${escapeHtml(characterAge(character))}</dd></div><div><dt>직업 · 직책</dt><dd>${escapeHtml(character.role)}</dd></div></dl><div class="character-scene-heading"><h3>순간의 기록</h3><span>${scenes.length}개 장면</span></div><div class="character-scene-options" role="group" aria-label="상황 선택">${scenes.map((scene,index)=>`<button class="character-scene-option" type="button" data-character-scene="${index}" aria-pressed="${index===characterSceneIndex}" aria-label="${escapeHtml(scene.label)} 이미지"><small>${String(index+1).padStart(2,'0')}</small><span>${escapeHtml(scene.label)}</span></button>`).join('')}</div><p class="character-scene-hint">상황을 선택하거나 좌우 화살표로 넘겨 보세요.</p><details class="character-story"><summary>인물 소개</summary><p>${escapeHtml(character.description)}</p><p>${escapeHtml(character.note)}</p><div class="profile-tags">${character.tags.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div></details>`;
    }
    function syncCharacterDetail(){
      if(!(characterDialog instanceof HTMLDialogElement))return;
      const character=activeView==='characters'?matchingCharacters().find(item=>item.id===selectedId):null;
      if(!mediaEntered||!character){
        if(characterDialog.open){characterCloseReason='route';characterDialog.close('route')}
        updateCharacterCards();return;
      }
      const changed=characterDetailId!==character.id;
      if(changed){
        characterDetailId=character.id;characterSceneIndex=0;
        if(!(characterOpener instanceof HTMLElement)||characterOpener.dataset.person!==String(character.id))characterOpener=roster?.querySelector(`[data-person="${character.id}"]`)||null;
        renderCharacterDetail(character);
      }
      if(!characterDialog.open){characterCloseReason='user';characterDialog.scrollTop=0;characterDialog.showModal();document.body.classList.add('character-dialog-active');characterDialogClose?.focus({preventScroll:true})}
      if(changed)updateCharacterScene();
      updateCharacterCards();refreshMedia();
    }
    function moveCharacterScene(direction){
      const character=characters.find(item=>item.id===characterDetailId);if(!character)return;
      const length=scenesFor(character).length;if(!length)return;
      characterSceneIndex=(characterSceneIndex+direction+length)%length;updateCharacterScene();
    }
    characterDialogClose?.addEventListener('click',()=>{characterCloseReason='user';characterDialog?.close('user')});
    characterScenePrev?.addEventListener('click',()=>moveCharacterScene(-1));
    characterSceneNext?.addEventListener('click',()=>moveCharacterScene(1));
    profile?.addEventListener('click',event=>{
      const button=event.target instanceof Element?event.target.closest('[data-character-scene]'):null;
      if(!(button instanceof HTMLButtonElement))return;
      const index=Number(button.dataset.characterScene);const character=characters.find(item=>item.id===characterDetailId);
      if(!character||!Number.isInteger(index)||index<0||index>=scenesFor(character).length)return;
      characterSceneIndex=index;updateCharacterScene();
    });
    characterDialog?.addEventListener('keydown',event=>{
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();moveCharacterScene(event.key==='ArrowLeft'?-1:1);
      if(event.target instanceof Element&&event.target.closest('[data-character-scene]'))profile?.querySelector(`[data-character-scene="${characterSceneIndex}"]`)?.focus({preventScroll:true});
    });
    characterDialog?.addEventListener('cancel',()=>{characterCloseReason='user'});
    characterDialog?.addEventListener('close',()=>{
      if(characterDialog.open)return; // A previous close event must not clear a newly opened detail.
      const closedId=characterDetailId;
      const routeClose=characterCloseReason==='route';
      document.body.classList.remove('character-dialog-active');
      characterDetailId=null;characterSceneIndex=0;characterCloseReason='user';
      if(!routeClose&&activeView==='characters'){selectedId=null;history.replaceState(null,'','#'+characterListHash())}
      if(characterStage)characterStage.innerHTML='';if(profile)profile.innerHTML='';
      updateCharacterCards();refreshMedia();
      const canFocus=element=>element instanceof HTMLElement&&element.isConnected&&!element.closest('[hidden]')&&element.getClientRects().length>0;
      const matchingCard=roster?.querySelector(`[data-person="${closedId}"]`);
      const heading=document.querySelector(`[data-view="${activeView}"] h1`);
      const destination=activeView==='characters'?(canFocus(characterOpener)?characterOpener:canFocus(matchingCard)?matchingCard:heading):heading;
      if(destination instanceof HTMLElement){if(destination===heading)destination.setAttribute('tabindex','-1');destination.focus({preventScroll:true})}
      characterOpener=null;
    });

    function currentPageHeading(){
      if(document.body.classList.contains('webtoon-reading')){
        return document.querySelector('#webtoon-phase-title');
      }
      return document.querySelector('[data-view="'+activeView+'"] h1');
    }
    const truthBookKey='academy-truth';
    const entryParams=new URLSearchParams(location.search);
    let truthReaderConfirmed=false;

    function truthReaderRoute(pageNumber){
      const page=['1','2','3'].includes(pageNumber)?pageNumber:'1';
      return '#world/'+truthBookKey+'/'+page;
    }

    const webtoonBooks=new Map([
      ['main-story',{
        title:'메인웹툰 · 입학식',
        phases:[
          {stripFolder:'./assets/webtoons/main-story/admission/01/', width:800, height:11754},
          {stripFolder:'./assets/webtoons/main-story/admission/02/', width:800, height:8664},
          {stripFolder:'./assets/webtoons/main-story/admission/03/', width:800, height:10792},
        ]
      }],
      ['childhood-friend',{
        title:'소꿉친구 웹툰 · NTR 모드 웹툰',
        phases:[
          {stripFolder:'./assets/webtoons/childhood-friend/prologue/01/', width:668, height:16232},
          {stripFolder:'./assets/webtoons/childhood-friend/prologue/02/', width:668, height:16367},
          {stripFolder:'./assets/webtoons/childhood-friend/prologue/03/', width:668, height:16097},
        ],
        legacyPhases:{4:2,5:3,6:3,7:3}
      }],
      [truthBookKey,{
        title:'아카데미의 진실',
        phases:[{},{},{}]
      }]
    ]);
    const webtoonReader=document.querySelector('#world-webtoon-reader');
    const webtoonTitle=document.querySelector('#webtoon-reader-title');
    const webtoonPhaseNav=document.querySelector('#webtoon-phase-nav');
    const webtoonPhasePanel=document.querySelector('#webtoon-phase');
    const webtoonAudioSlot=document.querySelector('#webtoon-reader-audio');
    const musicButton=document.querySelector('#music-toggle');
    const musicButtonHome=musicButton.parentNode;
    const musicButtonAfter=musicButton.nextSibling;
    const webtoonStripHeight=2048;
    let currentWebtoon;
    let currentWebtoonPhase=0;

    function renderWebtoonPhase(bookKey,book,phaseValue){
      const route='#world/'+bookKey+'/';
      const requested=Number(phaseValue);
      const phaseNumber=book.phases[requested-1]?requested:(book.legacyPhases?.[requested]||1);
      if(phaseValue&&String(phaseNumber)!==phaseValue){
        history.replaceState(history.state,'',route+phaseNumber);
      }
      if(book===currentWebtoon&&phaseNumber===currentWebtoonPhase)return false;

      const {stripFolder,width,height=0}=book.phases[phaseNumber-1];
      const strips=[];
      for(let top=0;top<height;top+=webtoonStripHeight){
        const index=strips.length+1;
        const stripFile=String(index).padStart(2,'0')+'.webp';
        const stripHeight=Math.min(webtoonStripHeight,height-top);
        strips.push(`
          <div class="webtoon-strip" style="--strip-ratio:${width} / ${stripHeight}">
            <span class="media-fallback" hidden><span>이미지를 불러올 수 없습니다</span></span>
            <img data-media-image data-src="${escapeHtml(stripFolder+stripFile)}" width="${width}" height="${stripHeight}" alt="${escapeHtml(book.title)} Phase ${phaseNumber} · 이미지 ${index}" decoding="async" loading="lazy">
          </div>`);
      }

      webtoonTitle.textContent=book.title;
      webtoonPhaseNav.innerHTML=book.phases.map((_,index)=>{
        const number=index+1;
        const current=number===phaseNumber?' aria-current="page"':'';
        return `<a href="${route}${number}"${current}>Phase ${number}</a>`;
      }).join('');
      webtoonPhasePanel.innerHTML=`
        <h3 class="webtoon-phase-title" id="webtoon-phase-title" tabindex="-1">Phase ${phaseNumber}</h3>
        <div class="webtoon-page">${strips.join('')||'<p class="webtoon-page-empty">웹툰 준비 중</p>'}</div>
        <nav class="webtoon-pagination" aria-label="웹툰 페이지 이동">
          ${phaseNumber>1?`<a href="${route}${phaseNumber-1}">이전페이지</a>`:'<button type="button" disabled>이전페이지</button>'}
          ${phaseNumber<book.phases.length?`<a href="${route}${phaseNumber+1}">다음페이지</a>`:
            `<button type="button" class="webtoon-end-button" data-webtoon-recommendations="${bookKey}" aria-haspopup="dialog">마지막 페이지입니다.<small>다른 웹툰 보기 →</small></button>`}
        </nav>`;
      currentWebtoon=book;
      currentWebtoonPhase=phaseNumber;
      return true;
    }

    function updateWebtoonReader(bookKey,phaseValue){
      const book=webtoonBooks.get(bookKey);
      const wasOpen=!webtoonReader.hidden;
      webtoonReader.hidden=!book;
      document.body.classList.toggle('webtoon-reading',Boolean(book));
      if(book){
        if(musicButton.parentNode!==webtoonAudioSlot)webtoonAudioSlot.append(musicButton);
        return renderWebtoonPhase(bookKey,book,phaseValue)||!wasOpen;
      }
      if(wasOpen)musicButtonHome.insertBefore(musicButton,musicButtonAfter);
      return wasOpen;
    }
    function updateView(){
      let parts=location.hash.slice(1).split('/');
      let spoilerRoute;
      const url=new URL(location.href);
      const legacyPrelude=url.searchParams.get('entry')==='truth';
      const legacyRoute=parts[0]==='truth';
      const needsConfirmation=parts[0]==='world'&&parts[1]===truthBookKey&&!truthReaderConfirmed;
      if(legacyPrelude||legacyRoute||needsConfirmation){
        const page=legacyRoute?(parts[1]==='archive'?parts[2]:parts[1]):legacyPrelude?parts[1]:parts[2];
        spoilerRoute=truthReaderRoute(page);
        if(legacyPrelude){url.searchParams.delete('entry');url.searchParams.delete('cue')}
        url.hash='world';
        history.replaceState(history.state,'',url);
        parts=['world'];
      }
      const requested=parts[0]||'home';
      const nextView=views.some(view=>view.dataset.view===requested)?requested:'home';
      const switched=nextView!==activeView;
      if(nextView!=='world'||parts[1]!==truthBookKey)truthReaderConfirmed=false;
      if(nextView==='characters'){
        if(parts[1]!==undefined&&validCharacterPart(parts[1])){
          activePart=parts[1];activeFilter=characterFilters(activePart).some(item=>item.key===parts[2])?parts[2]:'all';
          const candidate=activePart==='extras'?null:matchingCharacters().find(item=>String(item.id)===parts[3]);selectedId=candidate?.id??null;
        }else if(parts[1]!==undefined){
          activePart='all';activeFilter='all';
          const candidate=characters.find(item=>String(item.id)===parts[1]);
          selectedId=candidate?.id??null;
        }else{activePart='all';activeFilter='all';selectedId=null}
      }
      activeView=nextView;
      const readerChanged=updateWebtoonReader(activeView==='world'?parts[1]:undefined,parts[2]);
      document.body.classList.toggle('home-scene',activeView==='home');
      document.body.classList.toggle('fantasy-scene',['world','academy','characters'].includes(activeView));
      document.body.classList.toggle('characters-scene',activeView==='characters');
      views.forEach(view=>view.hidden=view.dataset.view!==activeView);
      navigation?.querySelectorAll('a').forEach(link=>{const current=link.hash==='#'+activeView;link.classList.toggle('active',current);if(current)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current')});
      navigation?.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false');
      if(activeView==='characters')renderCharacters();
      if(document.body.classList.contains('scene-entering')&&requested!=='home')completeEntry();
      if(switched||(readerChanged&&mediaEntered)){
        window.scrollTo({top:0,behavior:'instant'});
        const heading=currentPageHeading();
        if(heading&&!characterDialog?.open){
          heading.setAttribute('tabindex','-1');
          heading.focus({preventScroll:true});
        }
      }
      if(requested==='main')document.getElementById(requested)?.scrollIntoView();
      if(mediaEntered)prepareAcademyBackground();
      refreshMedia();syncCharacterDetail();syncAcademyAmbience();
      if(spoilerRoute){
        const opener=document.querySelector(entryScreen?.open?'#entry-truth':'#world [data-truth-confirm]');
        openSpoilerNotice(opener,spoilerRoute);
      }
    }
    document.addEventListener('click',event=>{    document.addEventListener('click',event=>{
      const target=event.target instanceof Element?event.target:null;


      const personButton=target?.closest('[data-person]');
      if(personButton){const candidate=characters.find(item=>String(item.id)===personButton.dataset.person);if(candidate){characterOpener=personButton;selectCharacterGroup(activePart,activeFilter,candidate.id)}return}
      const partButton=target?.closest('[data-character-part]');
      if(partButton){selectCharacterGroup(partButton.dataset.characterPart);return}
      const filterButton=target?.closest('[data-filter]');
      if(filterButton){
        selectCharacterGroup(filterButton.dataset.filterPart,filterButton.dataset.filter);
        const selectedFilter=document.querySelector(`[data-part-filters="${activePart}"] [data-filter="${activeFilter}"]`);
        if(selectedFilter instanceof HTMLButtonElement)selectedFilter.focus({preventScroll:true});
        return;
      }
      if(target?.closest('a[href^="#"]')){navigation?.classList.remove('open');menuToggle?.setAttribute('aria-expanded','false')}
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menuToggle?.getAttribute('aria-expanded')==='true'){navigation?.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');menuToggle.focus()}});
    window.addEventListener('hashchange',updateView);
    document.addEventListener('error',event=>{
      const image=event.target;
      if(!(image instanceof HTMLImageElement)||!image.hasAttribute('data-media-image'))return;
      const slot=image.parentElement;if(!slot)return;
      slot.classList.add('is-unavailable');const fallback=slot.querySelector('.media-fallback');if(fallback){fallback.hidden=false;if(!slot.classList.contains('person-thumb')){const message=fallback.querySelector('span');if(message)message.textContent='이미지를 불러올 수 없습니다';fallback.querySelector('small')?.remove()}}
      if(slot instanceof HTMLButtonElement)slot.disabled=true;
    },true);
    const entryScreen=document.querySelector('#entry-screen');
    const entryButton=document.querySelector('#entry-enter');
    const entryGateArchitecture=document.querySelector('#gate-architecture');
    const portraitGateMedia=window.matchMedia('(orientation: portrait) and (max-width: 760px)');
    const wideGateArt={
      src:'./academy-gate.webp', width:1672, height:941,
      leftHinge:464, rightHinge:1208,
      leftLeaf:'M836 0 H752 C634 46 478 127 463 325 L464 886 H836 Z',
      rightLeaf:'M836 0 H920 C1038 46 1194 127 1209 325 L1208 886 H836 Z'
    };
    const portraitGateArt={
      src:'./academy-gate-portrait.webp', width:736, height:2138,
      leftHinge:191, rightHinge:546,
      leftLeaf:'M368 791 C273 823 190 920 191 1018 L191 1410 H368 Z',
      rightLeaf:'M368 791 C463 823 547 920 546 1018 L546 1410 H368 Z',
      // Safe area for the arch, pillars, lanterns and threshold in the new artwork.
      safeWidth:640, safeTop:535, safeBottom:1460
    };
    let displayedGateArt=null;
    function updateGateArtwork(){
      if(!(entryGateArchitecture instanceof HTMLElement))return;
      const {clientWidth:width,clientHeight:height}=entryGateArchitecture;
      if(!width||!height)return;

      const isPortrait=portraitGateMedia.matches;
      const art=isPortrait?portraitGateArt:wideGateArt;
      const style=entryGateArchitecture.style;
      if(art!==displayedGateArt){
        entryGateArchitecture.querySelector('#gate-left-shape').setAttribute('d',art.leftLeaf);
        entryGateArchitecture.querySelector('#gate-right-shape').setAttribute('d',art.rightLeaf);
        for(const svg of entryGateArchitecture.querySelectorAll('.painted-gate svg')){
          svg.setAttribute('viewBox',`0 0 ${art.width} ${art.height}`);
          svg.querySelector('image').setAttribute('href',art.src);
        }
        style.setProperty('--gate-art',`url("${art.src}")`);
        style.setProperty('--gate-left-hinge',`${art.leftHinge/art.width*100}%`);
        style.setProperty('--gate-right-hinge',`${art.rightHinge/art.width*100}%`);
        displayedGateArt=art;
      }

      const cover=Math.max(width/art.width,height/art.height);
      let artWidth=art.width*cover;
      let artHeight=art.height*cover;
      let artCenterY=height/2;
      if(isPortrait){
        // At extreme aspect ratios, limit scaling on the cropped axis to protect the stone frame.
        artWidth=Math.min(artWidth,width/art.safeWidth*art.width);
        const scaleY=Math.min(cover,height/(art.safeBottom-art.safeTop));
        artHeight=art.height*scaleY;
        const centeredTop=(height-(art.safeTop+art.safeBottom)*scaleY)/2;
        const top=Math.max(height-artHeight,Math.min(0,centeredTop));
        artCenterY=top+artHeight/2;
      }
      style.setProperty('--gate-art-width',`${artWidth}px`);
      style.setProperty('--gate-art-height',`${artHeight}px`);
      style.setProperty('--gate-art-center-y',`${artCenterY}px`);
    }
    if(entryGateArchitecture instanceof HTMLElement){
      if(typeof ResizeObserver==='function')new ResizeObserver(updateGateArtwork).observe(entryGateArchitecture);
      else window.addEventListener('resize',updateGateArtwork,{passive:true});
    }
    const academyGateway=document.querySelector('#academy-gateway');
    const gatewaySkip=document.querySelector('#gateway-skip');
    const entryTimers=new Set();
    let entryConnecting=false;
    let gatewayOpening=false;
    function completeEntry(){
      if(!(entryScreen instanceof HTMLDialogElement)||!entryScreen.open)return;
      entryTimers.forEach(timer=>clearTimeout(timer));entryTimers.clear();
      document.body.classList.remove('scene-entering','interface-revealing','world-revealing');
      entryScreen.close();document.body.classList.remove('entry-active');
      mediaEntered=true;entryConnecting=false;prepareAcademyBackground();
      refreshMedia();syncAcademyAmbience();academyTheme.begin();
      const heading=currentPageHeading();if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true})}
      syncCharacterDetail();
    }
    function openAcademyGate(){
      if(gatewayOpening||!(entryScreen instanceof HTMLDialogElement)||!entryScreen.open)return;
      if(!(academyGateway instanceof HTMLElement)||window.matchMedia('(prefers-reduced-motion: reduce)').matches){completeEntry();return}
      if(activeView!=='home'||(location.hash&&location.hash!=='#home')){completeEntry();return}
      const stage=academyGateway.querySelector('.opening-stage');
      if(!(entryGateArchitecture instanceof HTMLElement)||!(stage instanceof HTMLElement)){completeEntry();return}
      gatewayOpening=true;entryTimers.forEach(timer=>clearTimeout(timer));entryTimers.clear();
      document.body.classList.add('scene-entering');window.scrollTo({top:0,behavior:'instant'});
      entryScreen.classList.add('gate-active');
      entryScreen.setAttribute('aria-labelledby','gateway-title');entryScreen.setAttribute('aria-describedby','gateway-description');
      stage.append(entryGateArchitecture);academyGateway.hidden=false;updateGateArtwork();
      gatewaySkip?.focus({preventScroll:true});
      const description=document.querySelector('#gateway-description');
      function startGateMotion(){
        academyGateway.dataset.phase='passing';
        academyGateway.classList.add('opening');
        scheduleEntry(()=>{
          entryGateArchitecture.hidden=true;
          academyGateway.dataset.phase='sky';
          if(description)description.textContent='이번에야말로 너를 지켜줄게';
        },1750);
      }
      startGateMotion();
      scheduleEntry(()=>{academyGateway.dataset.phase='title';if(description)description.textContent='루미에르 아카데미.'},7400);
      scheduleEntry(()=>{
        let revealed=false;let backgroundTimeout=null;
        function revealLandscape(){
          if(revealed||!entryScreen.open||activeView!=='home')return;
          revealed=true;
          if(backgroundTimeout!==null){clearTimeout(backgroundTimeout);entryTimers.delete(backgroundTimeout)}
          // Let the title disappear into the light before that light reveals the real home artwork.
          academyGateway.dataset.phase='title-departure';academyGateway.classList.add('title-departing');
          scheduleEntry(()=>{
            academyGateway.dataset.phase='world';academyGateway.classList.add('world-revealing');document.body.classList.add('world-revealing');
            if(description)description.textContent='하늘 너머로 아카데미의 풍경이 펼쳐집니다.';
          },1100);
          scheduleEntry(()=>{
            academyGateway.dataset.phase='interface';document.body.classList.add('interface-revealing');
            if(description)description.textContent='루미에르 아카데미에 오신 것을 환영합니다.';
          },2300);
          scheduleEntry(completeEntry,5100);
        }
        // Hold the title on slow connections until the landscape can replace the sky smoothly.
        if(academySceneImage instanceof HTMLImageElement&&!academySceneImage.complete&&typeof academySceneImage.decode==='function'){
          backgroundTimeout=scheduleEntry(revealLandscape,12000);
          academySceneImage.decode().catch(()=>{}).then(revealLandscape);
        }else revealLandscape();
      },8100);
    }
    function scheduleEntry(action,delay){
      const timer=setTimeout(()=>{entryTimers.delete(timer);if(entryScreen instanceof HTMLDialogElement&&entryScreen.open)action()},delay);
      entryTimers.add(timer);return timer;
    }
    function enterAcademy(){
      if(entryConnecting||!(entryScreen instanceof HTMLDialogElement)||!entryScreen.open)return;
      entryConnecting=true;
      academyTheme.prepare();prepareAcademyBackground();
      if(entryButton)entryButton.disabled=true;
      const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(reducedMotion){completeEntry();return}
      const logo=document.querySelector('#opening-logo');
      if(logo instanceof HTMLImageElement&&!logo.getAttribute('src')){
        logo.addEventListener('load',()=>logo.parentElement?.classList.add('has-logo'),{once:true});
        logo.src=logo.dataset.src;
      }
      openAcademyGate();
    }
    entryButton?.addEventListener('click',enterAcademy);
    const spoilerDialog=document.querySelector('#spoiler-dialog');
    const spoilerNo=document.querySelector('#spoiler-no');
    const spoilerYes=document.querySelector('#spoiler-yes');
    let spoilerOpener=null;
    let pendingTruthRoute;

    function openSpoilerNotice(opener,route=truthReaderRoute()){
      if(spoilerDialog.open)return;
      spoilerOpener=opener;
      pendingTruthRoute=route;
      spoilerDialog.returnValue='';
      spoilerDialog.showModal();
      document.body.classList.add('spoiler-active');
    }

    if(typeof bindWebtoonRecommendations==='function'){
      bindWebtoonRecommendations(new URL(location.href),(event,bookKey,opener)=>{
        if(bookKey!==truthBookKey)return;
        event.preventDefault();
        openSpoilerNotice(opener);
      },truthReaderRoute());
    }
    document.querySelector('#entry-truth').addEventListener('click',event=>openSpoilerNotice(event.currentTarget));
    document.querySelectorAll('[data-truth-confirm]').forEach(link=>link.addEventListener('click',event=>{
      event.preventDefault();
      openSpoilerNotice(link);
    }));
    spoilerNo.addEventListener('click',()=>spoilerDialog.close('no'));
    spoilerYes.addEventListener('click',()=>{
      if(!spoilerDialog.open)return;
      const route=pendingTruthRoute;
      truthReaderConfirmed=true;
      spoilerDialog.close('yes');
      document.body.classList.remove('spoiler-active');
      if(location.hash!==route)history.pushState(null,'',route);
      updateView();
      completeEntry();
    });
    spoilerDialog.addEventListener('close',()=>{
      if(spoilerDialog.open)return;
      document.body.classList.remove('spoiler-active');
      if(spoilerDialog.returnValue!=='yes'&&spoilerOpener instanceof HTMLElement&&!spoilerOpener.closest('[hidden]')){
        spoilerOpener.focus({preventScroll:true});
      }
      spoilerOpener=null;
      pendingTruthRoute=undefined;
    });
    gatewaySkip?.addEventListener('click',completeEntry);
    entryScreen?.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||entryConnecting||event.target.closest('#entry-truth'))return;
      event.preventDefault();
      if(!event.repeat)enterAcademy();
    });
    entryScreen?.addEventListener('cancel',event=>event.preventDefault());
    renderCharacters();
    if(entryScreen instanceof HTMLDialogElement){
      if(entryGateArchitecture instanceof HTMLElement)entryScreen.prepend(entryGateArchitecture);
      entryScreen.showModal();
      updateGateArtwork();
      document.body.classList.add('entry-active');
    }
    updateView();
    if(entryParams.get('entry')==='reader'&&!webtoonReader.hidden)completeEntry();
  