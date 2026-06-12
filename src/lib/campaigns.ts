import { db, cached } from './db';

export type CampaignItem = {
  url: string;
  type: 'image' | 'video';
  caption: string | null;
  link: string | null;
};

export type Campaign = {
  id: number;
  slug: string;
  title: string;
  seasonLine: string | null;
  description: string | null;
  items: CampaignItem[];
};

/** Campañas publicadas (la más reciente primero), con sus piezas. */
export async function getCampaigns(): Promise<Campaign[]> {
  return cached('campaigns', async () => {
    const [campaigns, items] = await Promise.all([
      db().execute(
        'SELECT * FROM campaigns WHERE published = 1 ORDER BY position DESC, id DESC',
      ),
      db().execute(
        `SELECT ci.* FROM campaign_items ci
         JOIN campaigns c ON c.id = ci.campaign_id AND c.published = 1
         ORDER BY ci.campaign_id, ci.position, ci.id`,
      ),
    ]);

    const itemsBy = new Map<number, CampaignItem[]>();
    for (const r of items.rows) {
      const cid = Number(r.campaign_id);
      if (!itemsBy.has(cid)) itemsBy.set(cid, []);
      itemsBy.get(cid)!.push({
        url: String(r.url),
        type: String(r.type) === 'video' ? 'video' : 'image',
        caption: r.caption ? String(r.caption) : null,
        link: r.link ? String(r.link) : null,
      });
    }

    return campaigns.rows.map((c) => ({
      id: Number(c.id),
      slug: String(c.slug),
      title: String(c.title),
      seasonLine: c.season_line ? String(c.season_line) : null,
      description: c.description ? String(c.description) : null,
      items: itemsBy.get(Number(c.id)) ?? [],
    }));
  });
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | undefined> {
  const campaigns = await getCampaigns();
  return campaigns.find((c) => c.slug === slug);
}
