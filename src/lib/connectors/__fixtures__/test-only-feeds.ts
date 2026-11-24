/** TEST-ONLY recorded-shape fixture. It must never be used by live ingestion. */
export const TEST_ONLY_GOOGLE_TRENDS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0">
  <channel>
    <title>Daily Search Trends</title>
    <item>
      <title>پاکستان سپر لیگ</title>
      <link>https://trends.google.com/trends/explore?q=psl</link>
      <guid isPermaLink="false">pk-psl-2026</guid>
      <pubDate>Mon, 23 Nov 2026 08:00:00 +0000</pubDate>
      <ht:approx_traffic>2,000+</ht:approx_traffic>
      <ht:picture>https://example.test/psl.jpg</ht:picture>
      <ht:news_item>
        <ht:news_item_title>PSL fixture announced</ht:news_item_title>
        <ht:news_item_url>https://publisher.example/psl-fixture</ht:news_item_url>
        <ht:news_item_source>Example News</ht:news_item_source>
      </ht:news_item>
      <ht:news_item>
        <ht:news_item_title>Teams prepare for the season</ht:news_item_title>
        <ht:news_item_url>https://sports.example/teams-prepare</ht:news_item_url>
        <ht:news_item_source>Example Sports</ht:news_item_source>
      </ht:news_item>
    </item>
    <item>
      <title>Weather update</title>
      <link>https://trends.google.com/trends/explore?q=weather</link>
      <pubDate>Mon, 23 Nov 2026 07:30:00 +0000</pubDate>
      <ht:approx_traffic>500+</ht:approx_traffic>
    </item>
  </channel>
</rss>`;

/** TEST-ONLY recorded-shape fixture. It must never be used by live ingestion. */
export const TEST_ONLY_GOOGLE_NEWS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google News</title>
    <item>
      <title>Major science mission launches - Example Daily</title>
      <link>https://news.google.com/rss/articles/test-article</link>
      <guid isPermaLink="false">news-test-1</guid>
      <pubDate>Mon, 23 Nov 2026 06:00:00 GMT</pubDate>
      <description><![CDATA[<a href="https://example.test/story">Major science mission launches</a>]]></description>
      <source url="https://example.test">Example Daily</source>
    </item>
  </channel>
</rss>`;

/** TEST-ONLY recorded-shape fixture. It must never be used by live ingestion. */
export const TEST_ONLY_PUBLISHER_RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
  <channel>
    <title>Example Publisher</title>
    <item>
      <guid isPermaLink="false">publisher-story-1</guid>
      <title><![CDATA[Detailed headline from Pakistan]]></title>
      <link>https://example.test/news/story-1?utm_source=rss</link>
      <description><![CDATA[<p>A <strong>short</strong> summary &amp; useful context.</p><script>bad()</script>]]></description>
      <pubDate>Mon, 23 Nov 2026 05:00:00 +0000</pubDate>
      <author>Reporter Name</author>
      <media:content url="https://example.test/image.jpg" type="image/jpeg" />
    </item>
  </channel>
</rss>`;

/** TEST-ONLY Atom fixture. It must never be used by live ingestion. */
export const TEST_ONLY_PUBLISHER_ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom</title>
  <entry>
    <id>tag:example.test,2026:story-2</id>
    <title>Atom headline</title>
    <link rel="alternate" href="https://example.test/news/story-2" />
    <updated>2026-11-23T04:00:00Z</updated>
    <summary type="html"><![CDATA[<p>Atom summary.</p>]]></summary>
    <author><name>Atom Reporter</name></author>
  </entry>
</feed>`;
