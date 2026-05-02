import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Security: seed passwords come from env vars in production
// In development they fall back to defaults — NEVER log passwords
function getSeedPassword(envVar: string, devDefault: string): string {
  return process.env[envVar] || devDefault;
}

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';

  // Block accidental production seeding of demo accounts
  if (isProduction && process.env.ALLOW_SEED !== 'true') {
    console.error('ERROR: Seeding is blocked in production. Set ALLOW_SEED=true to override.');
    process.exit(1);
  }

  console.log('Seeding SureEdge AI database...');

  // ─── Users ──────────────────────────────────────────────────────────────────
  const adminPw = getSeedPassword('SEED_ADMIN_PASSWORD', 'Admin@SureEdge1');
  const demoPw  = getSeedPassword('SEED_DEMO_PASSWORD',  'Demo@SureEdge1');
  const freePw  = getSeedPassword('SEED_FREE_PASSWORD',  'Free@SureEdge1');

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@sureedge.ai' },
    update: {},
    create: {
      email:        'admin@sureedge.ai',
      name:         'Admin',
      passwordHash: await bcrypt.hash(adminPw, 12),
      role:         'ADMIN',
      balance:      10000,
      totalProfit:  15420,
    },
  });

  const demo = await prisma.user.upsert({
    where:  { email: 'demo@sureedge.ai' },
    update: {},
    create: {
      email:        'demo@sureedge.ai',
      name:         'Demo User',
      passwordHash: await bcrypt.hash(demoPw, 12),
      role:         'PRO',
      balance:      5000,
      totalProfit:  4287,
    },
  });

  await prisma.user.upsert({
    where:  { email: 'free@sureedge.ai' },
    update: {},
    create: {
      email:        'free@sureedge.ai',
      name:         'Free User',
      passwordHash: await bcrypt.hash(freePw, 12),
      role:         'FREE',
      balance:      500,
      totalProfit:  120,
    },
  });

  console.log(`Created ${isProduction ? 'production' : 'demo'} users`);

  // ─── Bookmakers ────────────────────────────────────────────────────────────
  const bookmakers = [
    { name: 'Bet365',       reliability: 0.95, country: 'UK',      minStake: 0.10 },
    { name: 'William Hill', reliability: 0.93, country: 'UK',      minStake: 1.00 },
    { name: '1xBet',        reliability: 0.85, country: 'Cyprus',  minStake: 0.01 },
    { name: 'Pinnacle',     reliability: 0.97, country: 'Curacao', minStake: 1.00 },
    { name: 'DraftKings',   reliability: 0.94, country: 'USA',     minStake: 1.00 },
    { name: 'FanDuel',      reliability: 0.94, country: 'USA',     minStake: 1.00 },
    { name: 'Betfair',      reliability: 0.96, country: 'UK',      minStake: 2.00 },
    { name: 'Unibet',       reliability: 0.91, country: 'Malta',   minStake: 1.00 },
  ];

  const bmRecords = [];
  for (const bm of bookmakers) {
    const r = await prisma.bookmaker.upsert({ where: { name: bm.name }, update: {}, create: bm });
    bmRecords.push(r);
  }
  console.log(`Created ${bmRecords.length} bookmakers`);

  // ─── Events ────────────────────────────────────────────────────────────────
  const events = [
    { sport: 'Football', league: 'Premier League', homeTeam: 'Man City',    awayTeam: 'Arsenal',   startTime: new Date(Date.now() + 3600000),  status: 'upcoming' },
    { sport: 'Basketball', league: 'NBA',           homeTeam: 'Lakers',      awayTeam: 'Celtics',   startTime: new Date(Date.now() + 7200000),  status: 'upcoming' },
    { sport: 'Tennis',     league: 'ATP Finals',    homeTeam: 'Djokovic N.', awayTeam: 'Alcaraz C.',startTime: new Date(Date.now() + 10800000), status: 'upcoming' },
    { sport: 'Football',   league: 'La Liga',       homeTeam: 'Real Madrid', awayTeam: 'Barcelona', startTime: new Date(Date.now() + 14400000), status: 'upcoming' },
    { sport: 'Baseball',   league: 'MLB',           homeTeam: 'Yankees',     awayTeam: 'Dodgers',   startTime: new Date(Date.now() + 18000000), status: 'upcoming' },
  ];

  const eventRecords = [];
  for (const ev of events) {
    const r = await prisma.sportEvent.create({ data: ev });
    eventRecords.push(r);
  }
  console.log(`Created ${eventRecords.length} sport events`);

  // ─── Sample Bets ───────────────────────────────────────────────────────────
  await prisma.bet.createMany({
    data: [
      { userId: demo.id, bookmakerId: bmRecords[0].id, eventId: eventRecords[0].id, stake: 200, odds: 2.10, potentialWin: 420, status: 'PLACED' },
      { userId: demo.id, bookmakerId: bmRecords[3].id, eventId: eventRecords[0].id, stake: 190, odds: 2.30, potentialWin: 437, status: 'PLACED' },
      { userId: demo.id, bookmakerId: bmRecords[0].id, eventId: eventRecords[1].id, stake: 150, odds: 1.90, potentialWin: 285, status: 'WON' },
      { userId: demo.id, bookmakerId: bmRecords[2].id, eventId: eventRecords[1].id, stake: 145, odds: 2.05, potentialWin: 297, status: 'LOST' },
    ],
    skipDuplicates: true,
  });

  // ─── Sample Transactions ───────────────────────────────────────────────────
  await prisma.transaction.createMany({
    data: [
      { userId: demo.id, type: 'deposit',  amount: 5000, description: 'Initial deposit' },
      { userId: demo.id, type: 'withdraw', amount: 500,  description: 'Withdrawal to bank' },
      { userId: demo.id, type: 'profit',   amount: 287,  description: 'Arbitrage profit - Week 1' },
      { userId: demo.id, type: 'profit',   amount: 412,  description: 'Arbitrage profit - Week 2' },
      { userId: admin.id, type: 'deposit', amount: 10000, description: 'Admin initial balance' },
    ],
    skipDuplicates: true,
  });

  // ─── Alerts ────────────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      { userId: demo.id, type: 'SUREBET', title: 'High-Value Surebet Detected', message: 'Man City vs Arsenal — 4.2% ROI across Bet365 and Pinnacle.' },
      { userId: demo.id, type: 'SUREBET', title: 'New Surebet Opportunity',     message: 'Lakers vs Celtics — 2.8% ROI detected.', isRead: true },
      { userId: demo.id, type: 'ODDS_DROP', title: 'Odds Movement Alert',       message: 'Significant odds drop on Djokovic vs Alcaraz.' },
    ],
    skipDuplicates: true,
  });

  // ─── Subscription ──────────────────────────────────────────────────────────
  await prisma.subscription.upsert({
    where:  { id: 'demo-sub-1' },
    update: {},
    create: {
      id:              'demo-sub-1',
      userId:          demo.id,
      plan:            'PRO',
      status:          'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });

  console.log('\nSeeding complete!');
  // Security: do NOT log passwords — check env vars or documentation instead
  if (!isProduction) {
    console.log('Demo login: demo@sureedge.ai (see SEED_DEMO_PASSWORD env or dev default)');
    console.log('Admin login: admin@sureedge.ai (see SEED_ADMIN_PASSWORD env or dev default)');
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
