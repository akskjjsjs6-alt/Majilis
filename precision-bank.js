/* Majlis — the precision round's built-in questions.
   The first 20 questions of the precision round come from this bank, picked one at a time for each person, so they show
   instantly (no AI). How it works:
   - Every ideology below has a typical score on the test's axes (0 to 100, the same axes the test gives you).
   - Your test scores give each ideology a starting likelihood: the closer its typical scores are to yours, the likelier.
   - Each bank answer lists the ideologies that would pick it (and where it sits on a few axes, for the others).
   - After each answer the likelihoods are updated, and the next question is the one whose answer is expected to tell the
     ideologies still in the running apart the most. A question everyone near you would answer the same way is skipped.
   The AI then writes the last 20, starting from the ideologies this ranks closest.

   Axes (low to high): ex Left/Right, ey Interventionist/Laissez-faire, px Nationalist/Globalist, py Authoritarian/Libertarian,
   sx Traditional/Progressive, sy Collectivist/Individualist, dm Autocratic/Democratic, ml Militarist/Pacifist,
   as Assimilationist/Multicultural, rl Religious/Secular, tc Bioconservative/Accelerationist, fd Unitary/Federal,
   pr Protectionist/Free-trade, and the moral foundations fc Care, ff Fairness, fl Loyalty, fa Authority, fs Sanctity. */

// code: [name, typical scores, the faith it is rooted in (if any)]
const PB_IDEOLOGIES = {
  DS: ['Democratic socialism', { ex: 15, ey: 20, py: 60, sx: 75, dm: 90, rl: 70, as: 70, pr: 40, fc: 85, ff: 80, fa: 30 }],
  ML: ['Marxism–Leninism', { ex: 3, ey: 3, py: 10, dm: 15, rl: 90, sx: 50, fa: 70, fl: 70, ml: 35, fd: 15 }],
  LS: ['Libertarian socialism', { ex: 10, ey: 30, py: 90, dm: 90, sx: 85, rl: 80, fd: 85, fa: 15, as: 80 }],
  AS: ['Anarcho-syndicalism', { ex: 5, ey: 35, py: 95, dm: 85, fd: 95, sx: 80, rl: 85, fa: 10, ml: 50 }],
  MS: ['Market socialism', { ex: 25, ey: 65, py: 60, dm: 85, sx: 65, pr: 60 }],
  ES: ['Eco-socialism', { ex: 10, ey: 15, py: 60, sx: 85, tc: 25, pr: 30, ml: 75, fc: 90, as: 75 }],
  SD: ['Social democracy', { ex: 30, ey: 30, py: 55, px: 60, sx: 70, dm: 90, pr: 55, rl: 65, fc: 80, ff: 75 }],
  CS: ['Christian socialism', { ex: 20, ey: 25, sx: 55, rl: 25, fc: 90, ff: 80, fs: 55, dm: 85, ml: 75, as: 65 }, 'Christianity'],
  CD: ['Christian democracy', { ex: 40, ey: 40, py: 45, px: 60, sx: 30, rl: 20, dm: 85, fl: 60, fa: 60, fs: 65, fd: 65 }, 'Christianity'],
  DI: ['Distributism', { ex: 35, ey: 45, sx: 25, rl: 20, fd: 80, pr: 35, tc: 30, fs: 65 }, 'Christianity'],
  SL: ['Social liberalism', { ex: 40, ey: 45, py: 70, px: 75, sx: 85, rl: 80, dm: 90, as: 80, pr: 75, fc: 80, fa: 30 }],
  CL: ['Classical liberalism', { ex: 75, ey: 80, py: 80, px: 70, sx: 60, sy: 80, dm: 85, pr: 90, rl: 70 }],
  LI: ['Libertarianism', { ex: 85, ey: 95, py: 95, sx: 65, sy: 95, pr: 95, rl: 75, fa: 20, ml: 65 }],
  MI: ['Minarchism', { ex: 85, ey: 90, py: 90, sx: 50, sy: 90, pr: 90, fa: 30 }],
  AC: ['Anarcho-capitalism', { ex: 95, ey: 100, py: 100, sy: 100, pr: 100, dm: 50, fa: 10 }],
  OB: ['Objectivism', { ex: 90, ey: 95, py: 85, sy: 100, rl: 95, fc: 30, tc: 75 }],
  OR: ['Ordoliberalism', { ex: 60, ey: 55, py: 65, px: 70, sx: 50, dm: 85, pr: 80, fd: 60 }],
  NL: ['Neoliberalism', { ex: 70, ey: 80, px: 85, py: 60, pr: 95, tc: 70, dm: 80 }],
  TW: ['Third Way', { ex: 55, ey: 60, px: 75, sx: 65, dm: 85, pr: 80 }],
  LC: ['Liberal conservatism', { ex: 65, ey: 70, sx: 40, px: 55, dm: 85, pr: 75, fa: 55 }],
  ON: ['One-nation conservatism', { ex: 45, ey: 40, sx: 35, px: 45, dm: 80, fl: 70, fa: 65, pr: 50 }],
  NC: ['National conservatism', { ex: 50, ey: 40, px: 15, py: 35, sx: 20, as: 15, rl: 35, pr: 25, fl: 85, fa: 75, fs: 70, ml: 40 }],
  PC: ['Paleoconservatism', { ex: 60, ey: 60, px: 10, sx: 10, as: 10, rl: 25, pr: 20, ml: 65, fd: 75, fs: 75, fl: 80 }],
  NE: ['Neoconservatism', { ex: 65, ey: 65, px: 70, sx: 40, ml: 10, dm: 80, pr: 80, fl: 70 }],
  TR: ['Traditionalist conservatism', { sx: 5, rl: 15, fa: 80, fs: 85, fl: 80, tc: 15, dm: 55 }],
  RP: ['Right-wing populism', { ex: 50, ey: 35, px: 10, py: 40, as: 15, pr: 20, fl: 80, dm: 65 }],
  LP: ['Left-wing populism', { ex: 20, ey: 20, px: 35, dm: 75, pr: 30, fc: 75 }],
  TE: ['Technocracy', { ey: 30, dm: 40, tc: 85, rl: 80, px: 70, fa: 50 }],
  GR: ['Green politics', { ex: 35, ey: 40, py: 70, px: 75, sx: 85, tc: 35, ml: 80, fd: 70, fc: 85 }],
  GE: ['Georgism', { ex: 45, ey: 65, py: 70, pr: 85, fd: 55, ff: 85 }],
  CR: ['Civic republicanism', { ex: 40, ey: 45, py: 60, dm: 95, fd: 55, sx: 55, ff: 75 }],
  CO: ['Communitarianism', { ex: 40, ey: 40, sx: 40, sy: 15, fl: 70, fa: 55 }],
  CM: ['Constitutional monarchy', { sx: 25, dm: 70, fa: 80, fl: 75, px: 40 }],
  KE: ['Kemalism', { ex: 40, ey: 35, px: 25, rl: 90, sx: 65, fd: 10, as: 20, fl: 75, dm: 60, tc: 65 }],
  GA: ['Gaullism', { ex: 45, ey: 30, px: 25, ml: 30, fd: 20, fl: 80, dm: 75, pr: 40 }],
  ID: ['Islamic democracy', { ex: 40, ey: 40, rl: 10, dm: 80, sx: 25, fs: 75 }, 'Islam'],
  IS: ['Islamism', { rl: 0, dm: 35, sx: 5, fs: 90, fa: 80, py: 20 }, 'Islam'],
  AU: ['Authoritarian conservatism', { py: 10, dm: 20, sx: 15, fa: 90, fl: 85, ml: 30 }],
  PR: ['Progressivism', { ex: 35, ey: 35, sx: 90, as: 85, rl: 80, tc: 65, dm: 85, fc: 85 }],
  AG: ['Agrarianism', { ex: 40, sx: 25, tc: 20, fd: 70, pr: 25 }],
  CA: ['Christian anarchism', { py: 95, rl: 15, ml: 100, fd: 90 }, 'Christianity'],
  CF: ['Confucianism', { dm: 40, fa: 80, fl: 75, sx: 30, sy: 15 }],
  HN: ['Hindutva', { px: 10, rl: 20, as: 10, fl: 85, fs: 80 }, 'Hinduism'],
  CP: ['Corporatism', { ex: 50, ey: 15, py: 30, fa: 70, fl: 70, sy: 20 }],
  MU: ['Mutualism', { ex: 30, ey: 70, py: 90, fd: 90 }],
  CE: ['Centrism', { ex: 50, ey: 50, px: 50, py: 50, sx: 50, sy: 50, dm: 80, ml: 50, as: 50, rl: 55, tc: 55, fd: 50, pr: 60, fc: 60, ff: 60, fl: 55, fa: 50, fs: 45 }],
  RC: ['Radical centrism', { ex: 50, ey: 55, px: 65, py: 60, sx: 60, dm: 85, tc: 75, pr: 70, ff: 65 }],
  LB: ['Liberalism', { ex: 55, ey: 60, px: 70, py: 75, sx: 70, sy: 70, dm: 90, pr: 80, rl: 70, as: 70, fa: 35 }],
  SC: ['Social conservatism', { ex: 50, ey: 50, sx: 15, rl: 30, fs: 75, fl: 70, fa: 65, dm: 75, as: 30 }],
};

// Each question: [id, areas, question, four answers]; each answer: [text, where it sits on a few axes, codes of the
// ideologies that would pick it].
const PB_QUESTIONS = [
  ['land', ['economic'], 'Should land be taxed on its value, whether or not anything is built on it, instead of taxing wages?', [
    ['Yes. Land belongs to everyone, so tax land and cut taxes on work', { ey: 65 }, 'GE'],
    ['Land should belong to the community or the state, not to private owners', { ex: 5 }, 'ML LS AS ES'],
    ['No. Keep taxing income, with higher rates for the rich', { ex: 30, ey: 30 }, 'SD DS SL CE LB'],
    ['No. Owning land is a basic right and shouldn\'t be taxed at all', { ex: 85, ey: 90 }, 'LI MI AC OB PC']]],
  ['coops', ['economic'], 'Should most companies be owned by the people who work in them?', [
    ['Yes, and those co-ops should still compete in a free market', { ex: 25, ey: 65 }, 'MS MU'],
    ['Yes, run through unions that link up across each industry', { ex: 5, py: 95 }, 'AS LS'],
    ['No. Big industries should be owned and planned by the state', { ex: 5, ey: 5 }, 'ML'],
    ['No. Owners and shareholders should run the businesses they own', { ex: 80, ey: 80 }, 'CL LI MI AC OB NL LC CE LB']]],
  ['property', ['economic', 'social'], 'What is the best way to own a country\'s farms, shops and workshops?', [
    ['Spread out, so as many families as possible own a small business or farm', { ex: 35, fd: 80 }, 'DI AG CA'],
    ['Owned by the people who work there, as co-operatives', { ex: 20 }, 'MS MU LS AS'],
    ['Owned by the public and run for everyone', { ex: 5, ey: 10 }, 'ML DS'],
    ['By whoever builds or buys them. Big firms are fine if they win customers', { ex: 85, ey: 85 }, 'CL LI NL AC OB MI CE LB']]],
  ['boards', ['economic'], 'Should workers get seats on the boards of big companies, next to the owners?', [
    ['Yes. Bosses and workers should run firms as partners', { ex: 40 }, 'CD SD OR CS ON CP CE'],
    ['That\'s not enough. Workers should run the firms outright', { ex: 10 }, 'DS LS AS MS MU'],
    ['Only if the owners choose to give them seats', { ex: 75, ey: 80 }, 'CL LI MI NL LC OB AC LB'],
    ['The state should decide how big firms are run, in the national interest', { ey: 10, py: 20 }, 'CP ML AU GA KE']]],
  ['bigtech', ['economic', 'political'], 'A few giant tech firms dominate the market. What should happen?', [
    ['Break them up and keep strict rules so competition stays fair', { ex: 55, ey: 50 }, 'OR SL GE CR LP CE RC LB'],
    ['Take them into public ownership', { ex: 5, ey: 5 }, 'ML DS ES'],
    ['Leave them alone. If they get lazy, new rivals will beat them', { ex: 90, ey: 95 }, 'LI AC OB MI NL CL'],
    ['Make them serve the nation: keep data at home and follow national rules', { px: 10, py: 30 }, 'NC RP GA CP KE']]],
  ['money', ['economic', 'political'], 'Who should set interest rates and control how much money there is?', [
    ['An independent central bank, kept out of politics by strict rules', { ex: 60, py: 60 }, 'OR NL TW LC CL CE RC LB NE'],
    ['The elected government, so it can use them to create jobs', { ex: 30, ey: 25 }, 'DS LP SD GA'],
    ['No central bank. People should choose their own money, like gold or crypto', { ex: 95, ey: 100 }, 'AC LI MI MU'],
    ['Experts appointed by the state, planning for long-term growth', { ey: 25, dm: 40 }, 'TE CF ML']]],
  ['poor', ['economic', 'social'], 'What is the best way to help people who are poor?', [
    ['A generous welfare state open to everyone, paid for by taxes', { ex: 25, ey: 25 }, 'SD DS PR SL LB CS'],
    ['Families, churches and local communities first, with the state as a backup', { sx: 25, fd: 75 }, 'CD DI CS PC CO TR SC'],
    ['Private charity and donations, not taxes', { ex: 90, ey: 95 }, 'LI MI AC'],
    ['A basic income paid to every citizen, no questions asked', { ex: 35, py: 75 }, 'GE LS GR']]],
  ['rent', ['economic'], 'Rents in your city have doubled in five years. What should the government do?', [
    ['Cap rents and build lots of public housing', { ex: 15, ey: 20 }, 'DS LP ES SD'],
    ['Scrap planning rules so builders can build far more homes', { ex: 75, ey: 85 }, 'CL LI NL TW CE RC LB'],
    ['Tax land values, so leaving land empty costs too much', { ey: 60 }, 'GE'],
    ['Cut immigration, so fewer people are looking for homes', { px: 10, as: 15 }, 'RP NC PC']]],
  ['imports', ['economic', 'political'], 'Cheap imports are closing factories in your country. What should happen?', [
    ['Put tariffs on imports to protect our industry and workers', { pr: 15, px: 20 }, 'NC PC RP GA LP AG'],
    ['Keep trade free. Shoppers gain, and workers can retrain', { pr: 90, px: 80 }, 'CL NL LI TW SL OR CE RC LB NE'],
    ['Trade freely only with countries that respect workers and nature', { pr: 50, ex: 30 }, 'SD ES GR DS'],
    ['The state should take over key industries so they can\'t close', { ex: 10, ey: 10 }, 'ML CP KE']]],
  ['growth', ['economic', 'philosophical'], 'Should rich countries stop chasing economic growth to protect the planet?', [
    ['Yes. We need to use less, even if we end up poorer', { tc: 20, ex: 15 }, 'ES GR CA AG'],
    ['No. Green technology lets us keep growing and stay clean', { tc: 80, ey: 50 }, 'TE NL TW SL CE RC LB'],
    ['No. Growth matters more, and most climate rules cost too much', { ex: 75, ey: 80 }, 'LI MI RP AC'],
    ['Keep growing, with the state steering investment into clean industry', { ey: 25 }, 'SD DS GA']]],
  ['strikes', ['economic', 'political'], 'Should nurses and train drivers be allowed to go on strike?', [
    ['Yes, and other workers should be able to strike alongside them', { ex: 10, py: 80 }, 'AS DS LS LP'],
    ['Yes, but a minimum service must keep running', { ex: 50 }, 'SD SL CD TW OR CE RC LB SC'],
    ['No. Essential services are too important to stop', { py: 25, fa: 70 }, 'AU NC CP KE GA'],
    ['Unions shouldn\'t have special protection in law at all', { ex: 85, ey: 90 }, 'LI AC MI']]],
  ['change', ['political', 'economic'], 'If an economic system is deeply unfair, how should it be changed?', [
    ['By revolution, led by an organised party of workers', { ex: 0, py: 10 }, 'ML'],
    ['By workers taking over their workplaces and running them themselves', { ex: 5, py: 95 }, 'AS LS MU'],
    ['Step by step, by winning elections and passing laws', { ex: 30, dm: 90 }, 'DS SD PR GR CE RC LB'],
    ['Free exchange between people is already the fairest system there is', { ex: 90 }, 'LI AC OB CL MI']]],
  ['nostate', ['political', 'philosophical'], 'Could society work without any government at all?', [
    ['Yes, with free markets and private firms providing everything', { ey: 100, py: 100 }, 'AC'],
    ['Yes, with people running things through workers\' councils and communities', { ex: 5, py: 100 }, 'AS LS MU CA'],
    ['No, but government should only run the police, courts and defence', { ey: 90, py: 90 }, 'MI LI CL'],
    ['No. A strong state is needed for order and the common good', { py: 25, fa: 75 }, 'AU CF NC TR KE ML CD ON CE SC']]],
  ['godslaw', ['religious', 'political'], 'Should a country\'s laws be based on religious teaching?', [
    ['Yes. God\'s law should be the law of the land', { rl: 0, dm: 30 }, 'IS TR'],
    ['Faith should guide our values, but elected parliaments make the laws', { rl: 25, dm: 85 }, 'CD ID CS DI HN SC'],
    ['No. Religion should be kept out of public life altogether', { rl: 95 }, 'KE OB TE ML'],
    ['No, but people should be free to practise any faith openly', { rl: 75, as: 80 }, 'SL CL LI PR SD CE RC LB']]],
  ['scarf', ['religious', 'social'], 'Should a teacher in a state school be allowed to wear religious clothing, like a headscarf or a cross?', [
    ['Yes. Freedom of religion includes how you dress', { as: 85 }, 'SL CL LI PR CD CE LB'],
    ['No. State schools must be strictly secular', { rl: 95, as: 20 }, 'KE'],
    ['Only symbols of the country\'s traditional faith', { rl: 25, as: 15 }, 'NC TR PC HN RP'],
    ['Yes, and modest religious dress should be encouraged', { rl: 5 }, 'IS ID']]],
  ['blasphemy', ['religious', 'social'], 'Should insulting a religion or its holy figures be against the law?', [
    ['Yes. Holy things deserve the protection of the law', { rl: 5, fs: 90, py: 20 }, 'IS TR HN AU'],
    ['No, but it should be seen as rude and discouraged', { rl: 35 }, 'CD ID CO CS CE SC'],
    ['No. Mocking any belief is part of free speech', { rl: 90, py: 85 }, 'CL LI OB SL KE LB RC'],
    ['Only when it is used to stir up hatred against believers', { as: 75 }, 'PR SD GR']]],
  ['faithschools', ['religious', 'economic'], 'Should the state pay for religious schools?', [
    ['Yes. Parents should be able to choose a faith school at no cost', { rl: 20 }, 'CD ID DI CS HN SC'],
    ['No. Public money should only go to secular schools', { rl: 90 }, 'KE SL PR SD TE ML'],
    ['There should be no state schools: parents choose and pay for any school', { ey: 95 }, 'LI AC MI'],
    ['Give parents vouchers to spend at any school, religious or not', { ey: 75, rl: 50 }, 'CL NL LC']]],
  ['monarch', ['political'], 'Should a country have a king or queen as head of state?', [
    ['Yes. A monarch above party politics unites the nation', { fa: 80, fl: 80 }, 'CM TR PC'],
    ['Only as a figurehead with no real power', { dm: 80 }, 'LC CD SD CE LB'],
    ['No. The head of state should always be elected', { dm: 95 }, 'CR SL KE DS PR GA'],
    ['No. We don\'t need a head of state at all', { py: 100 }, 'AS LS AC CA']]],
  ['experts', ['political', 'philosophical'], 'Who should make the big decisions on complicated issues like energy or pandemics?', [
    ['Scientists and experts, even if voters disagree', { dm: 35, tc: 80 }, 'TE CF'],
    ['Elected politicians, advised by experts', { dm: 85 }, 'SD SL LC CD TW CE RC LB SC'],
    ['Ordinary people directly, through referendums and citizens\' assemblies', { dm: 100, py: 80 }, 'CR LP LS RP'],
    ['A strong leader who can act quickly', { dm: 15, py: 10 }, 'AU ML']]],
  ['exams', ['political'], 'Should top officials be chosen by tough exams and experience instead of elections?', [
    ['Yes. Rule by the wise and capable works better than votes', { dm: 25 }, 'CF TE'],
    ['Civil servants yes, but leaders must be elected', { dm: 80 }, 'OR SL TW CD CE RC LB'],
    ['No. Every important post should answer to voters', { dm: 100 }, 'CR LP DS RP'],
    ['No. Power should rest with tradition and the nation\'s rightful leaders', { fa: 85 }, 'TR AU CM']]],
  ['regions', ['political'], 'Should regions or provinces make most of their own laws?', [
    ['Yes. Power belongs as close to the people as possible', { fd: 90 }, 'DI PC LS AS CA MU GR'],
    ['Some, but national laws should come first', { fd: 50 }, 'CD SD SL CE SC LB'],
    ['No. One nation, one set of laws from the capital', { fd: 10 }, 'KE GA NC AU ML'],
    ['More power should go upwards instead, to bodies like the EU or UN', { px: 95 }, 'TE NL']]],
  ['union', ['political'], 'Should your country be part of a union of nations that shares laws, like the EU?', [
    ['Yes, and it should become an even closer union', { px: 95 }, 'SL GR TE PR NL LB RC'],
    ['Yes for trade, but each nation should keep its own laws', { px: 55 }, 'LC CL OR CD TW CE SC'],
    ['No. Our country should make all its own laws', { px: 10 }, 'NC PC RP GA KE'],
    ['Only if it puts workers before big business', { px: 50, ex: 20 }, 'DS LP SD']]],
  ['newcomers', ['social'], 'What should people who move to a country be expected to do?', [
    ['Learn the language and take on the national culture', { as: 15 }, 'NC KE GA RP PC'],
    ['Learn the language and obey the law, but keep their own culture', { as: 60 }, 'LC CD SD CL CE LB SC'],
    ['Nothing special. A mix of cultures makes a country stronger', { as: 95 }, 'PR SL GR LS'],
    ['Live by the faith and values of the community they join', { as: 20, rl: 15 }, 'IS HN TR']]],
  ['borders', ['social', 'political'], 'Should people be free to move to any country they like?', [
    ['Yes. Borders shouldn\'t stop people looking for a better life', { px: 100, as: 90 }, 'LI AC LS AS PR'],
    ['Fairly freely, chosen by the skills the economy needs', { px: 70 }, 'NL CL TW LC CE RC LB NE'],
    ['Only in limited numbers, to protect workers\' wages', { px: 35, ex: 25 }, 'LP SD DS'],
    ['In very small numbers, to protect the nation\'s identity', { px: 5, as: 10 }, 'NC PC RP HN AU']]],
  ['ally', ['political'], 'An ally of your country is invaded. What should your country do?', [
    ['Send troops and fight alongside them', { ml: 15 }, 'NE NC LC GA'],
    ['Send weapons and aid, but not soldiers', { ml: 50 }, 'SD SL CD OR TW CE RC LB'],
    ['Stay out of it. It isn\'t our war', { ml: 70, px: 15 }, 'PC LI RP MI'],
    ['Push hard for peace talks. War is never the answer', { ml: 100 }, 'CA ES GR LS CS']]],
  ['spread', ['political', 'philosophical'], 'Should powerful democracies use force to spread democracy to other countries?', [
    ['Yes. Freedom is worth fighting for', { ml: 10, px: 80 }, 'NE'],
    ['Only with the UN\'s backing, to stop mass killing', { ml: 50, px: 90 }, 'SL SD GR CD CE LB'],
    ['No. Every nation should choose its own path', { ml: 70, px: 20 }, 'PC GA NC LI KE'],
    ['No. Those wars mostly serve big business and empire', { ml: 90, ex: 10 }, 'ML DS LP AS ES']]],
  ['service', ['political', 'social'], 'Should every young person do a year of military or national service?', [
    ['Yes. Military service builds discipline and love of country', { ml: 15, fl: 85 }, 'NC KE AU GA RP NE'],
    ['Yes, but they could choose community service instead', { fl: 60 }, 'CR CO CD CE SC'],
    ['No. Forcing people to serve is wrong', { py: 95 }, 'LI CL MI AC SL'],
    ['No, and armies should be cut back', { ml: 95 }, 'ES CA GR LS']]],
  ['abortion', ['social', 'religious'], 'Should abortion be legal?', [
    ['Yes. It should be the woman\'s choice', { sx: 90 }, 'PR SL SD DS LI GR'],
    ['Only early in pregnancy, or in hard cases', { sx: 50 }, 'LC TW CE RC'],
    ['Only to save the mother\'s life', { sx: 15, rl: 15 }, 'TR CD ID PC IS DI CS SC'],
    ['Each region should decide for itself', { fd: 90 }, 'MI']]],
  ['marriage', ['social', 'religious'], 'Should two men or two women be able to marry?', [
    ['Yes, exactly like any other couple', { sx: 90 }, 'PR SL SD CL GR DS LB'],
    ['Civil partnerships yes, but marriage is between a man and a woman', { sx: 40 }, 'CD LC ON'],
    ['No. It goes against faith and tradition', { sx: 5, rl: 10 }, 'TR IS HN PC AU NC SC ID'],
    ['The state shouldn\'t be involved in anyone\'s marriage', { py: 95, sy: 95 }, 'AC MI LI']]],
  ['dying', ['social', 'philosophical'], 'Should doctors be allowed to help someone who is very ill end their life, if they ask?', [
    ['Yes. It\'s their life and their choice', { sx: 85, py: 85 }, 'LI SL OB CL PR'],
    ['Yes, but only with strict checks by doctors and judges', { sx: 65 }, 'SD TW TE CE RC LB'],
    ['No. Life is sacred and must be protected', { fs: 90, rl: 10 }, 'CD TR IS ID DI CS'],
    ['No. Vulnerable people would feel pressured to die', { fc: 85, sx: 40 }, 'CO DS']]],
  ['drugs', ['social'], 'Should drugs like cannabis be legal?', [
    ['All drugs should be legal. Adults can decide for themselves', { py: 95 }, 'LI AC OB MI'],
    ['Cannabis should be legal and regulated, and addiction treated as a health issue', { sx: 80 }, 'SL PR GR SD LB RC'],
    ['Keep them illegal, but focus on treatment', { sx: 45 }, 'CD LC TW CE SC ID'],
    ['Keep them illegal, with tough punishments', { py: 10, fa: 85 }, 'AU NC RP IS TR KE']]],
  ['guns', ['social', 'political'], 'Should ordinary people be allowed to own guns?', [
    ['Yes. Defending yourself is a basic right', { py: 85, sy: 85 }, 'LI MI AC PC'],
    ['Only for hunting and sport, with strict licences', { py: 50 }, 'LC CD SL SD CE LB SC'],
    ['No. Only the police and soldiers should have them', { py: 25 }, 'PR TE KE AU GR'],
    ['Yes. Workers and communities should be able to defend themselves', { ex: 10, py: 80 }, 'AS LS']]],
  ['death', ['social', 'philosophical'], 'Should the death penalty be used for the worst crimes?', [
    ['Yes. Some crimes deserve death', { fa: 85 }, 'RP NC AU IS PC'],
    ['No, but life in prison should really mean life', { fa: 60 }, 'LC CD TW CE SC'],
    ['No. Prison should be about turning people\'s lives around', { fc: 90 }, 'SL PR SD DS GR LB CS'],
    ['No. The state should never have the power to kill', { py: 95, ml: 95 }, 'LI CA LS']]],
  ['cameras', ['political', 'social'], 'Should police be able to use face-recognition cameras on public streets?', [
    ['Yes, if it catches criminals and keeps people safe', { py: 20 }, 'AU NC KE TE RP'],
    ['Only with a judge\'s permission each time', { py: 60 }, 'SL LC CD OR SD CE RC LB'],
    ['No. It\'s a step towards a police state', { py: 95 }, 'LI CL MI AC OB'],
    ['No, and police powers should be cut back a lot', { py: 95, ex: 10 }, 'LS AS DS']]],
  ['hate', ['social', 'political'], 'Should hateful speech against minority groups be a crime?', [
    ['Yes. Words can do real harm', { as: 85, sx: 85 }, 'PR SD SL GR'],
    ['Only if it directly calls for violence', { py: 85 }, 'CL LI MI NL LB'],
    ['Yes, and so should speech that mocks the nation or its faith', { py: 20, fs: 80 }, 'AU IS HN NC'],
    ['Communities and websites should deal with it, not the law', { fd: 80, py: 80 }, 'LS AC']]],
  ['history', ['social'], 'How should schools teach the nation\'s history?', [
    ['With pride, so children love their country', { fl: 90 }, 'NC RP KE GA PC HN SC'],
    ['Honestly, good and bad, so children can think for themselves', { fl: 50 }, 'SL CL LC CD TW CE RC LB'],
    ['Focusing on the wrongs done to workers, women and minorities', { sx: 90, ex: 15 }, 'PR DS ES'],
    ['Parents and local communities should decide what is taught', { fd: 85 }, 'LI DI MI']]],
  ['homeparent', ['social', 'religious'], 'Is it better for children if one parent stays at home to raise them?', [
    ['Yes, and the mother is best suited to it', { sx: 5 }, 'TR IS PC HN'],
    ['Yes, and the state should support families who choose that', { sx: 30, fl: 70 }, 'CD DI NC CO SC ID'],
    ['It\'s up to each family. The state shouldn\'t take a side', { sy: 85 }, 'LI CL OB LC CE LB'],
    ['No. Free childcare should let both parents work equally', { sx: 90, ey: 20 }, 'PR SD DS SL']]],
  ['gender', ['social'], 'Should people be able to legally change their gender?', [
    ['Yes, simply by declaring it', { sx: 95 }, 'PR SL GR'],
    ['Yes, after medical checks', { sx: 65 }, 'SD LC TW CE RC'],
    ['No. Sex is fixed at birth', { sx: 5 }, 'TR IS NC RP PC HN SC'],
    ['The state shouldn\'t record anyone\'s sex or gender at all', { py: 95 }, 'LI AC']]],
  ['restday', ['religious', 'economic'], 'Should most shops close on a weekly day of rest, like Sunday or Friday?', [
    ['Yes. A shared day of rest protects family, faith and workers', { rl: 25, fs: 70 }, 'CD DI CS TR ID SC'],
    ['Yes, mainly to protect workers from overwork', { ex: 20 }, 'DS SD LP'],
    ['No. Shops and workers should choose for themselves', { ey: 90 }, 'LI CL NL MI LB'],
    ['Each town or region should decide', { fd: 85 }, 'PC GR']]],
  ['vice', ['social', 'religious'], 'Should the state ban or heavily restrict alcohol and gambling?', [
    ['Yes. They destroy families and go against faith', { rl: 5, fs: 90, py: 20 }, 'IS HN TR'],
    ['Keep them legal, but tax them heavily and limit advertising', { ey: 30 }, 'SD CD PR TE CE SC ID'],
    ['Keep them legal with light rules. Adults can decide', { py: 90 }, 'LI CL AC MI SL LB'],
    ['Each community should decide for itself', { fd: 85 }, 'DI PC LS']]],
  ['genes', ['philosophical', 'social'], 'Should parents be allowed to edit their babies\' genes to prevent disease or make them smarter?', [
    ['Yes. Science should be used to improve humanity', { tc: 95 }, 'TE OB'],
    ['Only to prevent serious disease, with strict rules', { tc: 60 }, 'SL SD TW CE RC LB'],
    ['No. We shouldn\'t play God', { tc: 10, fs: 90 }, 'TR CD IS DI PC HN SC'],
    ['Yes. It\'s the parents\' choice, not the state\'s', { tc: 80, py: 95 }, 'LI AC MI']]],
  ['ai', ['economic', 'philosophical'], 'Artificial intelligence could replace millions of jobs. What should happen?', [
    ['Embrace it fully. It will make everyone richer', { tc: 95, ey: 80 }, 'NL OB CL LI'],
    ['Tax the companies using it and pay everyone a basic income', { tc: 70, ex: 30 }, 'TE GE SL RC'],
    ['Slow it down with strict laws to protect jobs and people', { tc: 20 }, 'LP NC PC'],
    ['Workers should own the machines, so everyone shares the gains', { ex: 5 }, 'DS MS LS AS ML']]],
  ['energy', ['economic', 'political'], 'What is the best way to power the country?', [
    ['Nuclear power. It\'s clean and reliable', { tc: 80 }, 'TE NL LC CE RC LB'],
    ['Wind and solar, run by public or community companies', { ex: 20, tc: 40 }, 'ES GR DS'],
    ['Whatever is cheapest, including coal, oil and gas', { ey: 90 }, 'LI RP MI'],
    ['Our own resources first, so we never depend on other countries', { px: 10 }, 'NC GA KE']]],
  ['greentax', ['economic', 'social'], 'Should the government tax meat and petrol to cut pollution?', [
    ['Yes. Polluters should pay', { tc: 40, ey: 30 }, 'GR ES SD'],
    ['Only if all the money is paid back to people equally', { ey: 65 }, 'GE OR RC LB'],
    ['No. It hits the poor and people in the countryside hardest', { ex: 35, fd: 70 }, 'AG LP RP'],
    ['No. The government shouldn\'t tell people how to live', { py: 90 }, 'LI MI AC']]],
  ['farms', ['economic', 'social'], 'Should farmers get money from the state to keep small family farms going?', [
    ['Yes. Farming and country life are the heart of the nation', { fl: 80 }, 'AG DI NC PC GA'],
    ['Yes, but only for farming that protects nature', { tc: 40 }, 'GR ES'],
    ['No. Farms should compete like any other business', { pr: 90, ey: 90 }, 'LI NL CL OB'],
    ['Farmland should be owned and worked together, as collectives', { ex: 5 }, 'ML']]],
  ['inherit', ['economic'], 'Should big inheritances be heavily taxed?', [
    ['Yes. Inherited wealth is unearned and unfair', { ex: 15, ff: 85 }, 'DS SD SL GE CS'],
    ['Only lightly. Families should be able to pass on what they built', { ex: 60 }, 'LC CD DI CE SC'],
    ['No. It\'s the family\'s money, and it was already taxed once', { ex: 90 }, 'LI CL MI PC'],
    ['Inheritance should end. Wealth should go back to the community', { ex: 0 }, 'ML LS AS']]],
  ['billionaires', ['economic', 'philosophical'], 'Should billionaires exist?', [
    ['Yes. They earned it by creating value', { ex: 90 }, 'OB LI CL NL AC'],
    ['Yes, but they should pay much higher taxes', { ex: 35 }, 'SD SL TW PR CE RC LB'],
    ['No. No one should have that much while others struggle', { ex: 5 }, 'DS ML LS LP ES CS'],
    ['Only if they serve the nation, not just themselves', { px: 15, fl: 80 }, 'NC CP GA KE']]],
  ['phones', ['social', 'political'], 'Should children under 16 be banned from social media?', [
    ['Yes. It\'s harming children, and the state must step in', { py: 30 }, 'CO NC TR CD SC'],
    ['No. Parents should decide, not the government', { py: 85 }, 'LI CL MI'],
    ['Make tech firms change their apps instead of banning children', { ey: 30 }, 'SD SL OR PR CE RC LB'],
    ['Yes, and the state should control what all young people see online', { py: 10 }, 'AU IS ML KE']]],
  ['raising', ['social', 'religious'], 'Who should have the final say in how a child is raised?', [
    ['Their parents, almost always', { sy: 85 }, 'PC LI CL MI TR'],
    ['Their parents, guided by their faith community', { rl: 15 }, 'CD ID HN DI SC'],
    ['Their parents, but the state must step in to protect children\'s rights', { sx: 75 }, 'SL PR SD CE LB'],
    ['The state and community, raising children with shared values', { sy: 10 }, 'ML CF CO AU']]],
  ['goodsociety', ['philosophical'], 'What matters most for a society to be good?', [
    ['People doing their duty in their role, and respecting elders and the wise', { fa: 85, sy: 15 }, 'CF TR CO SC'],
    ['Every person being free to live as they choose', { sy: 95 }, 'LI CL OB SL LB'],
    ['Everyone being equal, with no one above anyone else', { ff: 95, ex: 10 }, 'DS LS AS'],
    ['Everyone living by God\'s will', { rl: 0 }, 'IS CA CD TR']]],
  ['courts', ['religious', 'social'], 'Should religious communities be allowed their own courts for family matters, like divorce?', [
    ['Yes, if both people agree to use them', { as: 85, rl: 30 }, 'ID LI MU'],
    ['No. There should be one law for everyone', { as: 15, rl: 85 }, 'KE SL CL NC RP CE RC LB'],
    ['Yes, and religious law should guide family life for everyone', { rl: 0, dm: 30, as: 10 }, 'IS'],
    ['Only for the nation\'s traditional faith', { rl: 20, as: 15 }, 'HN TR']]],
  ['strongman', ['political'], 'Is it sometimes better to have a strong leader who doesn\'t have to bother with elections?', [
    ['Yes. A wise, strong leader gets things done', { dm: 10 }, 'AU ML'],
    ['No, but an elected leader should have strong powers', { dm: 70, fa: 65 }, 'GA KE RP NE'],
    ['No. Power should be spread out and checked by courts and parliament', { dm: 90 }, 'SL CL CD LC OR SD CR CE RC LB SC ID CM'],
    ['No. There should be no rulers at all', { py: 100 }, 'AS LS AC CA']]],
  ['judges', ['political'], 'Should judges be able to strike down laws that parliament passes?', [
    ['Yes, to protect people\'s rights', { dm: 85, py: 75 }, 'SL CL OR CD LC CE RC LB'],
    ['No. The elected parliament should have the final word', { dm: 85, py: 45 }, 'LP RP DS CR'],
    ['Only to protect the founding principles of the constitution', { fa: 65 }, 'KE GA CM'],
    ['Religious scholars should check that laws follow the faith', { rl: 0, dm: 30 }, 'IS']]],
  ['vote16', ['political'], 'Should 16-year-olds be allowed to vote?', [
    ['Yes. The future is theirs', { sx: 85, dm: 95 }, 'PR GR SD SL'],
    ['No. 18 is the right age', { sx: 45 }, 'LC CD TW CE SC'],
    ['Voting should depend on passing a basic test on how government works', { dm: 40 }, 'TE CF'],
    ['Whatever the age, voting should be compulsory', { sy: 20, dm: 90 }, 'CR CO']]],
  ['aid', ['economic', 'political'], 'Should rich countries give much more aid to poor countries?', [
    ['Yes. It\'s our moral duty', { px: 90, fc: 85 }, 'SL PR CS GR CD'],
    ['No. Free trade helps poor countries more than aid does', { pr: 95 }, 'NL CL LI'],
    ['No. We should look after our own people first', { px: 10 }, 'NC RP PC'],
    ['Rich countries owe them repayment for empire and exploitation', { ex: 10, px: 70 }, 'DS ML ES']]],
  ['banks', ['economic'], 'In a crisis, the big banks are about to collapse. What should happen?', [
    ['Let them fail. Rescuing them rewards bad behaviour', { ey: 95 }, 'LI AC MI PC'],
    ['Rescue them, then break them up and regulate them hard', { ey: 35 }, 'SD SL OR LP CE RC LB'],
    ['Take them over and run banking for the public', { ex: 5 }, 'DS ML ES'],
    ['Rescue them. A stable financial system matters most', { ey: 60 }, 'NL TW LC']]],
  ['town', ['political'], 'Where should most decisions about a town be made?', [
    ['In the town itself, by the people who live there', { fd: 90 }, 'DI CR LS GR PC AG'],
    ['By the national government, so every town gets the same standards', { fd: 15 }, 'SD KE GA ML'],
    ['By the market: people choose where to live and what to pay for', { ey: 95 }, 'LI AC MI'],
    ['By local faith and community leaders', { rl: 20, fa: 70 }, 'TR CO IS']]],
  ['belong', ['social', 'philosophical'], 'What makes someone truly part of a nation?', [
    ['Being born into its people, faith and history', { as: 5, fl: 90 }, 'NC PC HN TR'],
    ['Sharing its values and being loyal to its constitution', { as: 40 }, 'CR KE GA LC CE RC SC'],
    ['Simply living there and obeying the law', { as: 85 }, 'SL CL LI PR LB'],
    ['Nations are made up. We are all citizens of the world', { px: 100 }, 'LS AS GR']]],
  ['police', ['social', 'political'], 'Should more money go to the police or to social services?', [
    ['The police. Order comes first', { fa: 85 }, 'RP NC AU LC'],
    ['Both, and tackle the causes of crime too', { fa: 55 }, 'SD CD TW CE SC RC'],
    ['Social services. Much of what police do should be handed to others', { fa: 15 }, 'PR DS ES'],
    ['Communities should run their own security', { py: 95 }, 'AC AS LS']]],
  ['benefits', ['economic', 'social'], 'Should people on unemployment benefits have to take any job they are offered?', [
    ['Yes. Help should come with a duty to work', { ex: 60, fa: 65 }, 'LC TW RP CD CE SC'],
    ['No. People should get support while they look for the right job', { ex: 25 }, 'SD DS PR CS'],
    ['There shouldn\'t be state benefits at all', { ey: 95 }, 'LI MI AC OB'],
    ['Everyone should get a basic income, job or not', { ex: 30, py: 70 }, 'GE LS GR']]],
  ['worship', ['religious', 'economic'], 'Should the state pay for churches, mosques and temples?', [
    ['Yes, for the nation\'s main faith, as part of its heritage', { rl: 25, fl: 80 }, 'TR NC HN CM SC'],
    ['Yes, fairly for all faiths, through a church tax people can opt out of', { rl: 40 }, 'CD ID'],
    ['No. Faiths should rely on their own believers', { rl: 75, ey: 80 }, 'LI CL SL LB'],
    ['No, and the state should keep religious groups under close control', { rl: 95, py: 25 }, 'KE ML']]],
  ['planning', ['economic'], 'Should the government decide what gets made and what it costs?', [
    ['Yes. A planned economy meets people\'s real needs', { ey: 0 }, 'ML'],
    ['Only for essentials like energy, housing and food', { ey: 25 }, 'DS ES LP'],
    ['No, but it should set firm rules so markets stay fair', { ey: 55 }, 'OR SD SL MS CE RC LB'],
    ['No. Prices should be set freely by buyers and sellers', { ey: 95 }, 'LI CL NL AC OB MI']]],
  ['tradition', ['social', 'philosophical'], 'When people want to change an old tradition, what should usually happen?', [
    ['Keep it. Traditions hold wisdom built up over centuries', { sx: 5 }, 'TR PC CM CF'],
    ['Change it slowly and carefully, keeping what works', { sx: 35 }, 'LC CD CE SC'],
    ['Change it if people now think it is unfair', { sx: 80 }, 'SL SD PR LB'],
    ['Sweep it away. Society needs rebuilding from the ground up', { sx: 90, ex: 5 }, 'ML ES AS']]],
  ['fourday', ['economic'], 'Should the working week be cut to four days by law?', [
    ['Yes, with no cut in pay', { ex: 10 }, 'DS LP ES GR'],
    ['Only where firms and workers agree to it', { ex: 55 }, 'SD SL TW CD CE RC LB'],
    ['No. The law shouldn\'t set working hours at all', { ey: 95 }, 'LI MI AC'],
    ['No. Hard work builds strong people and a strong nation', { fl: 75 }, 'NC KE CF AU']]],
  ['pay', ['economic', 'philosophical'], 'Is it fair that some people earn a hundred times more than others?', [
    ['Yes, if they earned it freely', { ex: 90 }, 'LI OB CL AC MI'],
    ['Some difference is fine, but the gap is far too wide', { ex: 35 }, 'SD SL CD TW PR CE RC LB'],
    ['No. Pay should be much more equal', { ex: 5 }, 'DS ML LS AS ES'],
    ['It\'s fair if it rewards the people who serve society most', { fa: 70 }, 'CF TE CP']]],
  ['matters', ['political', 'philosophical'], 'Which matters most in politics?', [
    ['The nation, and what binds its people together', { px: 10, fl: 90 }, 'NC GA KE RP HN PC'],
    ['Class: the struggle between workers and owners', { ex: 5 }, 'ML DS AS LS'],
    ['The individual and their rights', { sy: 95 }, 'LI CL OB MI SL LB'],
    ['Faith and the moral health of society', { rl: 10 }, 'IS TR CD ID SC']]],
  ['elite', ['political'], 'Is your country run by a corrupt elite that ignores ordinary people?', [
    ['Yes. The people must take power back from them', { dm: 80 }, 'RP LP'],
    ['Partly, and strong, honest institutions are the answer', { dm: 85 }, 'SL CD OR LC CR CE RC LB ID'],
    ['Yes. The rich and big business run everything', { ex: 10 }, 'DS ML LS'],
    ['No. Mostly, things work as they should', {}, 'TW NL TE']]],
  ['healthcare', ['economic', 'political'], 'Should the government pay for everyone\'s healthcare out of taxes?', [
    ['Yes, fully, and private healthcare should be small or gone', { ex: 10, ey: 10 }, 'DS ML ES LP'],
    ['Yes, but people should be free to pay for private care too', { ex: 40, ey: 40 }, 'SD SL CD TW CE RC LB CS'],
    ['Only for the poor, the old and the sick. Others should insure themselves', { ex: 70, ey: 70 }, 'CL LC NL MI'],
    ['No. People should pay for their own care or rely on charity', { ex: 95, ey: 95 }, 'LI AC OB']]],
];

const PB_AXIS_WEIGHT = { ex: 1, ey: 1, px: 1, py: 1, sx: 1, sy: 1, dm: 0.8, ml: 0.8, as: 0.8, rl: 0.8, tc: 0.8, fd: 0.8, pr: 0.8, fc: 0.5, ff: 0.5, fl: 0.5, fa: 0.5, fs: 0.5 };
const PB_CODES = Object.keys(PB_IDEOLOGIES);
const PB_BY_ID = Object.fromEntries(PB_QUESTIONS.map(q => [q[0], q]));

// Weighted distance (0 to 100) between two sets of scores, over the axes both have. With open set, every axis a has
// counts: where b has no typical score, the gap counts as a moderate default (so an ideology with only a few scores
// isn't closer to everyone than one with many).
const PB_OPEN_GAP = 10;
function pbDistance(a, b, open){
  let sum = 0, w = 0;
  for(const k in PB_AXIS_WEIGHT){
    if(typeof a[k] !== 'number') continue;
    if(typeof b[k] !== 'number'){ if(open){ sum += PB_AXIS_WEIGHT[k] * PB_OPEN_GAP * PB_OPEN_GAP; w += PB_AXIS_WEIGHT[k]; } continue; }
    const d = a[k] - b[k];
    sum += PB_AXIS_WEIGHT[k] * d * d; w += PB_AXIS_WEIGHT[k];
  }
  return w ? Math.sqrt(sum / w) : null;
}
// The starting likelihood of each ideology, from the test's scores (and faith, for the ideologies rooted in one).
function pbPrior(vec, religion){
  const out = {};
  const none = !religion || /^(Atheism|Agnosticism|Prefer not to say|Other)$/.test(religion);
  for(const c of PB_CODES){
    const [, prof, faith] = PB_IDEOLOGIES[c];
    const d = pbDistance(vec, prof, true);
    let p = d === null ? 0.2 : Math.exp(-(d * d) / (2 * 16 * 16));
    if(faith) p *= religion === faith ? 3 : none ? 0.25 : 0.2;
    out[c] = p;
  }
  return pbNormalize(out);
}
function pbNormalize(o){
  let t = 0;
  for(const k in o) t += o[k];
  for(const k in o) o[k] = t ? o[k] / t : 1 / PB_CODES.length;
  return o;
}
// How likely each answer to a question is for one ideology. Two things count: whether the answer lists it, and how
// near the answer sits to its typical scores on the axes the answer names. Nothing is ever ruled out by one answer
// (people don't agree with their ideology on everything), so every answer keeps some chance.
const PB_ANSWER_WEIGHT = 0.75;   // how much one answer counts against the test's scores (1 = fully)
const pbLikeCache = {};
function pbLikelihood(qid, code){
  const key = qid + ':' + code;
  if(pbLikeCache[key]) return pbLikeCache[key];
  const opts = PB_BY_ID[qid][3], prof = PB_IDEOLOGIES[code][1];
  const listed = opts.map(o => o[2].split(' ').includes(code));
  const anyListed = listed.some(Boolean);
  const w = opts.map((o, i) => {
    const tag = anyListed ? (listed[i] ? 1 : 0.15) : null;
    const d = pbDistance(o[1], prof), near = d === null ? null : Math.exp(-(d * d) / (2 * 22 * 22));
    const v = tag !== null && near !== null ? 0.6 * tag + 0.4 * near : tag !== null ? tag : near !== null ? near : 0.5;
    return v + 0.1;
  });
  const t = w.reduce((a, b) => a + b, 0);
  return (pbLikeCache[key] = w.map(x => Math.pow(x / t, PB_ANSWER_WEIGHT)));
}
// The likelihoods after the bank answers given so far ([{ id, opt }], opt being the answer's index).
function pbPosterior(vec, religion, answers){
  const post = pbPrior(vec, religion);
  for(const a of answers){
    if(!PB_BY_ID[a.id] || a.opt < 0) continue;
    for(const c of PB_CODES) post[c] *= pbLikelihood(a.id, c)[a.opt];
    pbNormalize(post);
  }
  return post;
}
// The same chances as true probabilities (they add up to 1), for working out which question tells the most.
function pbLike1(qid, code){ const l = pbLikelihood(qid, code), t = l.reduce((a, b) => a + b, 0); return l.map(x => x / t); }
const pbEntropy = (ps) => ps.reduce((h, p) => p > 0 ? h - p * Math.log(p) : h, 0);
// The next question: the one whose answer is expected to tell the likeliest ideologies apart the most, nudged away from
// the area of the last two questions and from any area that already has more than its share.
// exclude: ids already asked, skipped or waiting; recentAreas: the main area of each question asked, newest first.
function pbNext(post, exclude, recentAreas){
  const count = {};
  recentAreas.forEach(a => { if(a) count[a] = (count[a] || 0) + 1; });
  const codes = PB_CODES.slice().sort((a, b) => post[b] - post[a]).slice(0, 16);   // the field still in the running
  const mass = codes.reduce((t, c) => t + post[c], 0);
  const base = pbEntropy(codes.map(c => post[c] / mass));
  let best = null, bestScore = -Infinity;
  for(const q of PB_QUESTIONS){
    if(exclude.has(q[0])) continue;
    let gain = base;
    for(let o = 0; o < 4; o++){
      const joint = codes.map(c => post[c] / mass * pbLike1(q[0], c)[o]);
      const po = joint.reduce((a, b) => a + b, 0);
      if(po > 0) gain -= po * pbEntropy(joint.map(j => j / po));
    }
    const area = q[1][0];
    const score = gain * (recentAreas[0] === area ? 0.75 : 1) * (recentAreas[1] === area ? 0.8 : 1) * Math.pow(0.6, Math.max(0, (count[area] || 0) - 3));
    if(score > bestScore){ bestScore = score; best = q; }
  }
  return best;
}
const pbTop = (post, n) => PB_CODES.slice().sort((a, b) => post[b] - post[a]).slice(0, n).map(c => ({ code: c, name: PB_IDEOLOGIES[c][0], p: post[c] }));
// A bank question as the precision round shows it.
const pbItem = (q) => ({ id: q[0], q: q[2], opts: q[3].map(o => o[0]), areas: q[1].slice() });
