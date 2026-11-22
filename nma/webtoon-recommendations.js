'use strict';

function bindWebtoonRecommendations(academyUrl, onSelect) {
  const books = [
    { key: 'main-story', title: '메인웹툰', subtitle: '입학식', cover: 'academy-gate-portrait.webp' },
    { key: 'childhood-friend', title: '소꿉친구 웹툰', subtitle: 'NTR 모드 웹툰', cover: 'assets/webtoons/covers/childhood-friend.webp' },
    { key: 'academy-truth', title: '아카데미의 진실', subtitle: '스포일러 주의', cover: 'assets/webtoons/covers/academy-truth.webp' },
  ];

  const dialog = document.createElement('dialog');
  dialog.className = 'webtoon-recommendations';
  dialog.setAttribute('aria-labelledby', 'webtoon-recommendations-title');
  dialog.innerHTML = `
    <header class="webtoon-recommendations-header">
      <h2 id="webtoon-recommendations-title">다른 웹툰도 읽어보세요</h2>
      <button class="webtoon-recommendations-close" type="button" aria-label="추천 창 닫기" autofocus>×</button>
    </header>
    <div class="webtoon-recommendations-list"></div>`;
  const list = dialog.querySelector('.webtoon-recommendations-list');
  dialog.querySelector('.webtoon-recommendations-close').addEventListener('click', () => dialog.close());
  document.body.append(dialog);

  let opener;
  document.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('button[data-webtoon-recommendations]') : null;
    if (!trigger || dialog.open) return;
    opener = trigger;
    const currentBook = trigger.dataset.webtoonRecommendations;
    const cards = books.filter(book => book.key !== currentBook).map(book => {
      const link = document.createElement('a');
      const url = new URL(academyUrl);
      url.hash = book.key === 'academy-truth' ? 'world' : 'world/' + book.key + '/1';
      link.href = url.href;
      link.className = 'webtoon-recommendation';
      link.dataset.book = book.key;
      link.innerHTML = `
        <img src="${new URL(book.cover, academyUrl)}" alt="" decoding="async">
        <span class="webtoon-recommendation-label">
          <strong>${book.title}</strong>
          <small>${book.subtitle}</small>
          <span aria-hidden="true">보러가기 →</span>
        </span>`;
      return link;
    });
    list.replaceChildren(...cards);
    dialog.showModal();
    dialog.scrollTop = 0;
  });

  list.addEventListener('click', event => {
    const card = event.target instanceof Element ? event.target.closest('a[data-book]') : null;
    if (!card || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    dialog.close();
    onSelect(event, card.dataset.book, opener);
  });

  window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); });
}
