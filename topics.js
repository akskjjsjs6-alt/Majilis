/* =====================================================================
   Majlis topics: an endless supply of debate topics that are fun but meant seriously.
   Looksmaxing and appearance, hot political questions, and everyday things people argue about.
   MajlisTopics.at(n) always gives the same topic for the same n, so everyone in a room sees the
   same one, and n never runs out: topics are built by mixing hand-written questions with
   templates and subjects (thousands of different topics, and new mixes keep coming).
   To add more, just add lines to the lists below.
   ===================================================================== */
(function(){
  'use strict';

  /* ---------- hand-written topics ---------- */
  const LOOKS = [
    'Is mewing real or just an internet myth?', 'Is a strong jawline worth surgery?', 'Does height matter more than looks for men?',
    'Is looksmaxing self-improvement or insecurity with a plan?', 'Should teenagers be allowed cosmetic procedures?',
    'Are dating app photos basically fraud if they\'re heavily filtered?', 'Is skincare for guys still treated like a joke?',
    'Is a hair transplant just as legitimate as a good haircut?', 'Does being attractive make life unfairly easier?',
    'Should beauty filters have to be labelled?', 'Is "bonesmashing" dangerous nonsense?', 'Do looks matter more than personality in the first five minutes?',
    'Is gym culture really about health, or about looks?', 'Is height-lengthening surgery ever a sensible idea?',
    'Would you tell a friend their appearance is holding them back?', 'Is being called "ugly" ever helpful feedback?',
    'Are tanning and teeth whitening just the new makeup?', 'Is it shallow to rate people out of ten?',
    'Are men under more appearance pressure now than ever?', 'Should influencers have to show their unedited faces?',
    'Is it fair that attractive people earn more?', 'Is a good style more important than good genes?',
    'Is self-confidence the real looksmax?', 'Should schools teach kids about beauty standards and filters?',
    'Is fixing your teeth or nose "cheating"?', 'Do glow-ups prove anyone can improve, or that looks are mostly money?',
  ];
  const POLITICS = [
    'Should voting be allowed from age 16?', 'Should there be term limits for every politician?', 'Is a four-day work week realistic?',
    'Should the rich pay much higher taxes?', 'Is universal basic income a good idea?', 'Should social media be banned for under-16s?',
    'Should countries cap immigration, or open the doors wider?', 'Do tariffs protect workers or just raise prices?',
    'Should billionaires exist?', 'Is cancel culture a real problem or a made-up one?', 'Should politicians have to pass a basic knowledge test?',
    'Is the news too biased to trust?', 'Should AI-made political ads be banned?', 'Should there be a cap on how much a person can inherit?',
    'Is it fair for rich countries to lecture poor ones about climate?', 'Should the voting system use ranked choices?',
    'Is a free press more important than national security?', 'Should countries pay reparations for the past?', 'Should national service be compulsory?',
    'Should the police have a smaller or bigger role?', 'Do protests actually change anything?', 'Is the two-party system broken?',
    'Should governments regulate AI before it gets stronger?', 'Is it okay to ban a book from a school library?',
    'Should hate speech be a crime?', 'Does gun control work?', 'Should the age to buy alcohol be lowered?',
    'Is nuclear power the best answer to climate change?', 'Should rent be capped by law?', 'Should voting be mandatory?',
  ];
  const RANDOM = [
    'Is a hot dog a sandwich?', 'Is it rude to leave someone on read?', 'Should you split the bill evenly?', 'Is pineapple on pizza actually fine?',
    'Is cereal a soup?', 'Is it okay to recline your seat on a plane?', 'Should you tell a friend their partner is bad for them?',
    'Is it wrong to skip the line to help someone who is late?', 'Is reading the book better than the movie, every time?',
    'Is a breakfast better than a dinner?', 'Should you always say what you really think?', 'Is it okay to lie to spare someone\'s feelings?',
    'Is going to the gym in the morning better than at night?', 'Is it wrong to throw away old gifts?', 'Is texting back right away needy?',
    'Is a voice note better than a text, or just rude?', 'Does the "five-second rule" for dropped food count?', 'Would you rather be feared or liked?',
    'Is it okay to ghost someone after one date?', 'Is being early the same as being on time?', 'Is it worse to be bored or to be busy?',
    'Is a dog or a cat the better pet?', 'Should you wear shoes inside the house?', 'Is it okay to eat in the car?',
    'Is staying friends with an ex a good idea?', 'Is online dating better than meeting in person?', 'Is it fair to judge people by their taste in music?',
  ];

  /* ---------- templates × subjects (this is what makes it endless) ---------- */
  // Every subject is a singular noun phrase so every template reads correctly.
  const SEEDS = [
    { // looksmaxing
      subjects: ['mewing', 'jawline filler', 'a hair transplant', 'lip filler', 'a 12-step skincare routine', 'teeth whitening', 'a nose job', 'laser eye surgery for looks',
        'a height-boosting insole', 'a personal stylist', 'growing a beard', 'botox for men', 'a strict diet to look leaner', 'a full body wax', 'dyeing your hair', 'a tanning bed',
        'face-yoga', 'cosmetic surgery abroad', 'a gym routine built for looks', 'a rhinoplasty at eighteen', 'chin implants', 'eyebrow tinting', 'a cologne obsession',
        'getting veneers', 'a perfect side profile', 'a "glow-up" plan', 'photo filters on dating apps', 'a skincare fridge', 'minoxidil for hair', 'a cosmetic-surgery loan',
        'a symmetrical face', 'tracking your body fat', 'a shaved head', 'a facial-rating app', 'a jaw exerciser', 'a monthly facial', 'wearing makeup as a man', 'a "looks coach"',
        'orthodontics as an adult', 'a hair-removal laser', 'posture-correcting braces', 'a "face ranking" tier list'],
      templates: [x => 'Is ' + x + ' worth it?', x => 'Should teenagers be allowed ' + x + '?', x => 'Is ' + x + ' just insecurity sold back to you?',
        x => 'Would you tell a friend to try ' + x + '?', x => 'Is ' + x + ' more about looks or about confidence?', x => 'Is ' + x + ' still taboo, and should it be?',
        x => 'Does ' + x + ' really change how people treat you?', x => 'Would you try ' + x + ' if it were free?', x => 'Is ' + x + ' a scam?',
        x => 'Should ' + x + ' come with a health warning?', x => 'Is ' + x + ' shallow or smart?', x => 'Would you be embarrassed to admit to ' + x + '?'],
    },
    { // politics
      subjects: ['a four-day work week', 'universal basic income', 'a wealth tax', 'a higher minimum wage', 'free university', 'a carbon tax', 'compulsory voting',
        'a TikTok ban', 'a ban on political donations', 'term limits for politicians', 'free public transport', 'rent control', 'open borders', 'a size cap on tech giants',
        'AI rules for elections', 'a national ID card', 'a lower voting age', 'a ban on disposable vapes', 'a higher retirement age', 'a shorter election cycle',
        'a ban on private jets', 'mandatory national service', 'a tax on junk food', 'a social media age limit', 'a ban on political ads', 'a citizens\' assembly',
        'a four-day school week', 'a universal healthcare system', 'a ban on stock trading by politicians', 'a points-based immigration system', 'a world government',
        'a meat tax', 'a ban on gas cars', 'a government-run AI', 'lifetime bans for corrupt officials', 'a tax-free minimum income', 'a cap on rent increases', 'a digital ID for the internet',
        'a two-term limit for presidents', 'an end to the electoral college', 'a ban on lobbying', 'a tax on robots'],
      templates: [x => 'Would ' + x + ' make life better for ordinary people?', x => 'Is ' + x + ' a good idea or just a nice-sounding one?', x => 'Who would ' + x + ' actually hurt?',
        x => 'Should ' + x + ' be decided by a public vote?', x => 'Is ' + x + ' too big a change to try?', x => 'Would ' + x + ' survive a real crisis?',
        x => 'Is ' + x + ' what most people really want?', x => 'Would you vote for ' + x + '?', x => 'Would politicians ever really pass ' + x + '?',
        x => 'Is ' + x + ' left, right, or just common sense?', x => 'Would ' + x + ' work in your country?', x => 'Is the case for ' + x + ' stronger than the case against?'],
    },
    { // everyday
      subjects: ['pineapple on pizza', 'breakfast for dinner', 'the open-plan office', 'the group chat', 'the wedding gift', 'reading on your phone', 'tipping culture', 'the gym selfie',
        'online dating', 'working from home', 'splitting the bill', 'the school uniform', 'homework', 'the gap year', 'the voice note', 'the new year\'s resolution',
        'celebrity gossip', 'being early', 'small talk', 'staying up late', 'the morning routine', 'the reply-all email', 'the handshake', 'the surprise party', 'the "we should hang out" text',
        'the loud phone call on the train', 'the 5 a.m. club', 'the standing desk', 'the second date', 'the friend who is always late', 'the inspirational quote', 'the family group chat',
        'the dating-app bio', 'the long goodbye', 'the participation trophy', 'the stranger who says hi', 'the "just checking in" message', 'the pre-nup', 'the hustle culture post', 'the sad-boy playlist'],
      templates: [x => 'Is ' + x + ' overrated?', x => 'Has ' + x + ' gone too far?', x => 'Would the world be better without ' + x + '?',
        x => 'Is ' + x + ' a sign of a good person, or a bad one?', x => 'Should ' + x + ' be taken more seriously?', x => 'Can you really trust someone who loves ' + x + '?',
        x => 'Is ' + x + ' a red flag?', x => 'Is ' + x + ' a green flag?', x => 'Is ' + x + ' a generational thing?', x => 'Would you give up ' + x + ' for a year for money?',
        x => 'Is ' + x + ' really as harmless as it seems?', x => 'Does ' + x + ' say more about us than we admit?'],
    },
  ];
  // an optional opener, so the same question can come back worded a little differently
  const FRAMES = ['', '', '', 'Be honest: ', 'Serious question: ', 'Settle this: ', 'Hot take: ', 'No dodging: '];
  const HAND = [LOOKS, POLITICS, RANDOM];

  /* ---------- deterministic mixing ---------- */
  function mix(n){            // a small hash, so consecutive numbers look random
    n = (n | 0) + 0x6D2B79F5; n = Math.imul(n ^ (n >>> 15), n | 1); n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0);
  }
  function build(n){
    const h = mix(n), h2 = mix(h), h3 = mix(h2);
    const cat = h % HAND.length;                          // looks, politics, or everyday
    if(h2 % 5 < 2){                                       // two in five: a hand-written one
      const list = HAND[cat]; return list[h3 % list.length];
    }
    const s = SEEDS[cat];
    const q = s.templates[h3 % s.templates.length](s.subjects[h2 % s.subjects.length]);
    return FRAMES[mix(h3) % FRAMES.length] + q;
  }

  /* n is the topic number. The same n always returns the same topic, and a topic is never repeated back-to-back. */
  function at(n){
    n = Math.floor(Number(n) || 0);
    let t = build(n), k = 0;
    while(k < 8 && (t === build(n - 1) || t === build(n + 1))){ t = build(n + (++k) * 100003); }
    return t;
  }

  window.MajlisTopics = { at, count: 'endless' };
})();
