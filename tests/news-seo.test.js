// Trình soạn tin tức đợt 2026-10-13: SEO bài viết, ảnh trong bài, công cụ soạn
// thảo, trang tĩnh cho Facebook/Zalo và chuyển hướng đường dẫn cũ.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const APP_JS = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const articles = require('../scripts/prerender-articles');
const { prerenderDirectory } = require('../scripts/prerender-site-settings');

function loadDetailPage() {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'news-detail.html'), 'utf8'), {
    runScripts: 'dangerously',
    url: 'https://dhakimloaimau.vn/tin-tuc/bai-mau',
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  window.fetch = () => Promise.reject(new Error('network disabled in tests'));
  const script = window.document.createElement('script');
  script.textContent = APP_JS;
  window.document.body.appendChild(script);
  return window;
}

function sanitize(html) {
  const window = loadDetailPage();
  const out = new JSDOM(`<div>${window.sanitizeArticleHtml(html)}</div>`).window.document.body.firstElementChild;
  return out;
}

// ── Bộ lọc nội dung bài trên website ─────────────────────────────

test('link nội bộ không bị gắn nofollow/tab mới, link ngoài thì có', () => {
  const body = sanitize(`
    <p><a href="/products">sp</a> <a href="https://dhakimloaimau.vn/tin-tuc/x">tin</a>
    <a href="https://lme.com" rel="nofollow" target="_self">lme</a> <a href="https://vnexpress.net">vne</a>
    <a href="tel:0867259078">gọi</a></p>`);
  const [internal, sameHost, nofollow, external, tel] = body.querySelectorAll('a');

  for (const link of [internal, sameHost, tel]) {
    assert.equal(link.getAttribute('rel'), null, `${link.textContent}: không nofollow`);
    assert.equal(link.getAttribute('target'), null, `${link.textContent}: mở cùng tab`);
  }
  assert.equal(nofollow.getAttribute('target'), '_blank');
  assert.equal(nofollow.getAttribute('rel'), 'noopener noreferrer nofollow', 'giữ nofollow biên tập viên chọn');
  assert.equal(external.getAttribute('rel'), 'noopener noreferrer', 'link ngoài mặc định không nofollow');
});

test('ảnh giữ cỡ/căn hợp lệ, chú thích thành figcaption, class lạ bị bỏ', () => {
  const body = sanitize(`
    <img src="https://res.cloudinary.com/a.jpg" alt="Đồng" title="Kho đồng DHA" class="article-image img-md align-right hidden">
    <img src="https://res.cloudinary.com/b.jpg" alt="" class="img-sm btn-primary">`);

  const figure = body.querySelector('figure.article-figure');
  assert.ok(figure, 'ảnh có chú thích được bọc trong figure');
  assert.ok(figure.classList.contains('img-md') && figure.classList.contains('align-right'), 'cỡ/căn chuyển lên figure');
  assert.equal(figure.querySelector('figcaption').textContent, 'Kho đồng DHA');
  assert.equal(figure.querySelector('img').getAttribute('title'), null, 'title đã thành figcaption');
  assert.equal(figure.querySelector('img').getAttribute('class'), 'article-image', 'cỡ/căn chỉ nằm trên khung, class lạ bị bỏ');

  const plain = body.querySelectorAll('img')[1];
  assert.equal(plain.getAttribute('class'), 'img-sm article-image');
});

test('chỉ nhúng được video YouTube; khung nổi bật, căn chữ, bảng được giữ', () => {
  const body = sanitize(`
    <div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" onload="x()"></iframe></div>
    <iframe src="https://evil.example/embed/x"></iframe>
    <div class="article-callout"><p>Lưu ý</p></div>
    <div class="other"><p>bọc lạ</p></div>
    <p style="text-align: center">giữa</p><p style="color:red">đỏ</p>
    <table><tbody><tr><th colspan="2" onclick="x()">A</th></tr></tbody></table>`);

  const frames = body.querySelectorAll('iframe');
  assert.equal(frames.length, 1, 'iframe không phải YouTube bị xoá');
  assert.equal(frames[0].parentElement.className, 'article-video');
  assert.equal(frames[0].getAttribute('onload'), null);
  assert.ok(body.querySelector('div.article-callout'), 'khung nổi bật còn nguyên');
  assert.equal(body.querySelector('div.other'), null, 'div lạ bị gỡ lớp bọc');
  assert.ok(body.textContent.includes('bọc lạ'), 'nhưng giữ nội dung');
  const byText = (text) => [...body.querySelectorAll('p')].find((p) => p.textContent === text);
  assert.equal(byText('giữa').getAttribute('style'), 'text-align: center', 'căn lề được giữ');
  assert.equal(byText('đỏ').getAttribute('style'), null, 'style khác căn lề bị bỏ');
  assert.equal(body.querySelector('th').getAttribute('colspan'), '2');
  assert.equal(body.querySelector('th').getAttribute('onclick'), null);
});

test('meta của bài ưu tiên trường SEO, bỏ trống thì dùng tiêu đề/tóm tắt — app.js và prerender khớp nhau', () => {
  const window = loadDetailPage();
  const full = { title: 'Giá đồng', slug: 'gia-dong', summary: 'Tóm tắt', image: 'https://res.cloudinary.com/a.jpg', seo_title: 'Giá đồng hôm nay', seo_description: 'Mô tả SEO', share_image: 'https://res.cloudinary.com/share.jpg' };
  const bare = { title: 'Giá đồng', slug: 'gia-dong', summary: 'Tóm tắt', image: '/uploads/a.jpg' };
  const noCover = { title: 'Giá đồng', slug: 'gia-dong', summary: 'Tóm tắt', content: '<p>x</p><img src="/rel.jpg"><img src="https://res.cloudinary.com/in-bai.jpg?a=1&amp;b=2">' };

  for (const article of [full, bare, noCover]) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(window.articleMeta(article))),
      articles.articleMeta(article),
      `trình duyệt và prerender ra cùng meta cho ${article.seo_title ? 'bài có SEO' : 'bài không có SEO'}`,
    );
  }
  assert.equal(articles.articleMeta(full).title, 'Giá đồng hôm nay');
  assert.equal(articles.articleMeta(bare).title, 'Giá đồng - DHA Minerals');
  assert.equal(articles.articleMeta(bare).image, 'https://dhakimloaimau.vn/uploads/a.jpg', 'ảnh chia sẻ phải là địa chỉ tuyệt đối');
  assert.equal(articles.articleMeta(noCover).image, 'https://res.cloudinary.com/in-bai.jpg?a=1&b=2', 'không có ảnh đại diện thì dùng ảnh đầu tiên trong bài');
});

// ── Trang tĩnh từng bài + chuyển hướng ───────────────────────────

test('prerender ghi trang tĩnh cho từng bài, chuyển hướng đường dẫn cũ và dọn bài đã gỡ', async () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'dha-articles-'));
  fs.mkdirSync(path.join(target, 'tin-tuc', 'bai-da-xoa'), { recursive: true });
  fs.writeFileSync(path.join(target, 'tin-tuc', 'bai-da-xoa', 'index.html'), 'cũ');

  const list = [
    {
      title: 'Nhà máy luyện đồng </script><b>',
      slug: 'nha-may-luyen-dong',
      summary: 'Tóm tắt "có nháy"',
      image: 'https://res.cloudinary.com/a.jpg',
      date: '2026-01-02',
      old_slugs: ['dhakimloaimau.vn', '../thoat-ra', 'nha-may-luyen-dong'],
    },
  ];
  const empty = async () => ({});
  const result = await prerenderDirectory(target, {
    sourceDir: root,
    loadSettings: empty,
    loadCategories: async () => [],
    loadNavigation: empty,
    loadPageContent: empty,
    loadProducts: async () => [],
    loadAnalyses: async () => [],
    loadFormConfig: empty,
    loadArticles: async () => list,
    log: { warn() {} },
  });

  assert.equal(result.articles, 1);
  const page = fs.readFileSync(path.join(target, 'tin-tuc', 'nha-may-luyen-dong', 'index.html'), 'utf8');
  const doc = new JSDOM(page).window.document;
  assert.equal(doc.title, 'Nhà máy luyện đồng </script><b> - DHA Minerals');
  assert.equal(doc.querySelector('meta[property="og:image"]').content, 'https://res.cloudinary.com/a.jpg');
  assert.equal(doc.querySelector('meta[name="description"]').content, 'Tóm tắt "có nháy"');
  assert.equal(doc.querySelector('link[rel="canonical"]').href, 'https://dhakimloaimau.vn/tin-tuc/nha-may-luyen-dong');
  const jsonLd = JSON.parse(doc.getElementById('article-jsonld').textContent);
  assert.equal(jsonLd['@type'], 'NewsArticle');
  assert.equal(jsonLd.headline, 'Nhà máy luyện đồng </script><b>');
  assert.ok(!page.includes('</script><b>'), 'tiêu đề không phá được thẻ script JSON-LD');
  assert.ok(doc.getElementById('news-detail-content'), 'thân trang vẫn để app.js dựng');

  const redirect = fs.readFileSync(path.join(target, 'tin-tuc', 'dhakimloaimau.vn', 'index.html'), 'utf8');
  assert.match(redirect, /http-equiv="refresh" content="0; url=\/tin-tuc\/nha-may-luyen-dong"/);
  assert.match(redirect, /rel="canonical" href="https:\/\/dhakimloaimau\.vn\/tin-tuc\/nha-may-luyen-dong"/);

  assert.ok(!fs.existsSync(path.join(target, 'thoat-ra')), 'slug có ".." không thoát ra ngoài thư mục');
  const sitemap = fs.readFileSync(path.join(target, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/dhakimloaimau\.vn\/tin-tuc\/nha-may-luyen-dong<\/loc>/, 'sitemap có đường dẫn mới của bài');
  assert.doesNotMatch(sitemap, /tin-tuc\/dhakimloaimau\.vn</, 'sitemap không còn đường dẫn cũ');
  assert.equal(result.sitemapChanged, true);
  assert.ok(!fs.existsSync(path.join(target, 'tin-tuc', 'bai-da-xoa')), 'bài không còn đăng bị dọn');
});

test('đọc tin tức lỗi thì giữ nguyên trang tĩnh của lượt trước', async () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'dha-articles-'));
  fs.mkdirSync(path.join(target, 'tin-tuc', 'bai-cu'), { recursive: true });
  fs.writeFileSync(path.join(target, 'tin-tuc', 'bai-cu', 'index.html'), 'cũ');
  fs.writeFileSync(path.join(target, 'sitemap.xml'), 'sitemap cũ');

  const empty = async () => ({});
  await prerenderDirectory(target, {
    sourceDir: root,
    loadSettings: empty,
    loadCategories: async () => [],
    loadNavigation: empty,
    loadPageContent: empty,
    loadProducts: async () => [],
    loadAnalyses: async () => [],
    loadFormConfig: empty,
    loadArticles: async () => {
      throw new Error('CMS sập');
    },
    log: { warn() {} },
  });

  assert.ok(fs.existsSync(path.join(target, 'tin-tuc', 'bai-cu', 'index.html')));
  assert.equal(fs.readFileSync(path.join(target, 'sitemap.xml'), 'utf8'), 'sitemap cũ', 'sitemap cũ cũng được giữ');
});

test('trang chi tiết tự chuyển khi gặp đường dẫn cũ của bài', () => {
  // location.replace của jsdom không ghi đè được — kiểm qua nhánh mã nguồn.
  assert.match(APP_JS, /old_slugs\.includes\(slug\)/, 'tìm bài theo đường dẫn cũ');
  assert.match(APP_JS, /window\.location\.replace\(getArticleUrl\(moved\.slug\)\)/, 'chuyển sang đường dẫn mới');
});

// ── Server ghi nhớ đường dẫn cũ ─────────────────────────────────

test('đổi đường dẫn bài đã đăng thì cất đường dẫn đang đăng vào old_slugs', async () => {
  const { rememberOldSlugs } = require('../dha-cms/src/api/admin-ui/services/resources');
  const { getResourceConfig } = require('../dha-cms/src/api/admin-ui/services/resource-config');
  const config = getResourceConfig('news');

  let published = { slug: 'dhakimloaimau.vn', old_slugs: null };
  global.strapi = { documents: () => ({ findOne: async () => published }) };
  try {
    assert.deepEqual(
      await rememberOldSlugs(config, { slug: 'nha-may-luyen-dong' }, 'doc1'),
      { slug: 'nha-may-luyen-dong', old_slugs: ['dhakimloaimau.vn'] },
    );

    published = { slug: 'b', old_slugs: ['a'] };
    assert.deepEqual(await rememberOldSlugs(config, { slug: 'a' }, 'doc1'), { slug: 'a', old_slugs: ['b'] }, 'đổi ngược về đường dẫn cũ thì gỡ nó khỏi danh sách');

    published = { slug: 'b', old_slugs: ['a'] };
    assert.deepEqual(await rememberOldSlugs(config, { slug: 'b', title: 'x' }, 'doc1'), { slug: 'b', title: 'x' }, 'không đổi đường dẫn thì không đụng gì');

    published = null;
    assert.deepEqual(await rememberOldSlugs(config, { slug: 'moi' }, 'doc1'), { slug: 'moi' }, 'bài chưa từng đăng không có link cũ để giữ');
  } finally {
    delete global.strapi;
  }
});

test('bài viết lưu/xoá là ghi lại trang tĩnh', () => {
  const lifecycles = fs.readFileSync(path.join(root, 'dha-cms/src/api/news/content-types/news/lifecycles.js'), 'utf8');
  for (const hook of ['afterCreate', 'afterUpdate', 'afterDelete']) {
    assert.match(lifecycles, new RegExp(`${hook}\\(\\)\\s*\\{\\s*prerender\\.schedulePrerender\\(\\)`), hook);
  }
  const deploy = fs.readFileSync(path.join(root, 'deploy/deploy.sh'), 'utf8');
  assert.match(deploy, /--exclude="tin-tuc\/"/, 'rsync lúc deploy không xoá trang tĩnh của bài');
  const applyNginx = fs.readFileSync(path.join(root, 'deploy/apply-nginx.sh'), 'utf8');
  assert.match(applyNginx, /try_files \$uri \$uri\/index\.html \/news-detail\.html;/, 'script áp nginx nâng cấp được cấu hình cũ');
});

// ── Chấm điểm SEO trong admin ────────────────────────────────────

test('kiểm tra SEO trong admin chấm đúng các tiêu chí chính', async () => {
  const { analyzeSeo, isInternalHref } = await import(`file://${path.join(root, 'admin/src/lib/seo.js')}`);

  assert.equal(isInternalHref('/products'), true);
  assert.equal(isInternalHref('https://www.dhakimloaimau.vn/news'), true);
  assert.equal(isInternalHref('//evil.vn'), false);
  assert.equal(isInternalHref('https://lme.com'), false);

  const words = Array.from({ length: 320 }, () => 'đồng').join(' ');
  const good = analyzeSeo({
    title: 'Giá đồng hôm nay tăng mạnh',
    slug: 'gia-dong-hom-nay-tang-manh',
    focus_keyword: 'giá đồng hôm nay',
    seo_title: 'Giá đồng hôm nay tăng mạnh theo sàn LME - DHA',
    seo_description: 'Giá đồng hôm nay tăng mạnh theo sàn LME. Cập nhật bảng giá đồng cathode, đồng phế liệu và nhận định thị trường kim loại màu mới nhất từ DHA.',
    content: `<p>Giá đồng hôm nay tăng.</p><h2>Bảng giá</h2><p>${words}</p><img src="x" alt="Đồng"><p><a href="/products">sản phẩm</a></p>`,
  });
  assert.equal(good.score, 100, JSON.stringify(good.checks.filter((check) => check.status !== 'good')));

  const bad = analyzeSeo({ title: 'X', content: '<p>ngắn</p><img src="x">' });
  const byId = Object.fromEntries(bad.checks.map((check) => [check.id, check.status]));
  assert.equal(byId.keyword, 'warn', 'nhắc nhập từ khoá');
  assert.equal(byId.headings, 'bad');
  assert.equal(byId['image-alt'], 'bad', 'ảnh thiếu alt bị nêu');
  assert.equal(byId['internal-link'], 'bad');
  assert.equal(bad.title, 'X - DHA Minerals', 'xem trước dùng đúng tiêu đề website sẽ dùng');
});

test('trình soạn thảo có đủ công cụ và website cho qua đúng những gì nó sinh ra', () => {
  const editor = fs.readFileSync(path.join(root, 'admin/src/components/RichTextField.jsx'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'admin/package.json'), 'utf8'));

  for (const dep of ['underline', 'text-align', 'table', 'youtube']) {
    assert.ok(pkg.dependencies[`@tiptap/extension-${dep}`], `cài @tiptap/extension-${dep}`);
  }
  for (const command of ['toggleUnderline', 'setTextAlign', 'insertTable', 'setYoutubeVideo', 'toggleCallout', 'undo', 'redo']) {
    assert.match(editor, new RegExp(command), `có nút ${command}`);
  }
  assert.match(editor, /HTMLAttributes: \{ target: null, rel: null, class: null \}/, 'TipTap không tự gắn nofollow cho mọi link');
  assert.match(editor, /Mô tả ảnh \(alt\)/, 'sửa được mô tả ảnh sau khi chèn');
  assert.match(editor, /Chú thích dưới ảnh/, 'có chú thích ảnh');
  assert.match(APP_JS, /'article-callout'/, 'website giữ khung nổi bật');
  assert.match(APP_JS, /'article-btn'/, 'website giữ nút kêu gọi');
});
