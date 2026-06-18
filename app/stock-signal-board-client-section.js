'use client';

import { useEffect, useState } from 'react';
import { StockSignalBoardLoadingCard, StockSignalBoardView } from './stock-signal-board-view.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const INITIAL_PAGE_SIZE = 20;

export default function StockSignalBoardClientSection() {
  const [viewModel, setViewModel] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPage({ offset = 0, append = false, attempt = 1 } = {}) {
      try {
        const response = await fetch(`/api/stock-signal-board?limit=${INITIAL_PAGE_SIZE}&offset=${offset}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        if (!active) return;

        setViewModel((current) => {
          if (!append || !current?.rows?.length) {
            return payload;
          }

          return {
            ...payload,
            rows: [...current.rows, ...payload.rows],
          };
        });
        setStatus('ready');
        setLoadingMore(false);
      } catch (error) {
        if (!active) return;

        if (!append && attempt < MAX_RETRIES) {
          window.setTimeout(() => {
            void loadPage({ offset, append, attempt: attempt + 1 });
          }, RETRY_DELAY_MS);
          return;
        }

        console.error(`Stock Signal Board ${append ? 'load more' : 'load'} failed:`, error);
        if (!active) return;
        if (append) {
          setLoadingMore(false);
          return;
        }

        setStatus('error');
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading') {
    return (
      <StockSignalBoardLoadingCard
        title="Stock Signal Board laddar efter första renderingen"
        copy="Dashboarden visas direkt, medan de första 20 aktierna laddas separat för att inte blockera hela sidan."
      />
    );
  }

  if (status === 'error' || !viewModel?.rows?.length) {
    return (
      <StockSignalBoardLoadingCard
        title="Stock Signal Board kunde inte laddas nu"
        copy="Ladda om sidan om en stund. Cockroach-svaret för första tabellblocket kom inte tillbaka i tid."
      />
    );
  }

  async function handleLoadMore() {
    if (!viewModel?.pagination?.hasMore || loadingMore) {
      return;
    }

    setLoadingMore(true);
    await fetch(`/api/stock-signal-board?limit=${INITIAL_PAGE_SIZE}&offset=${viewModel.pagination.nextOffset}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((payload) => {
        setViewModel((current) => ({
          ...payload,
          rows: [...(current?.rows ?? []), ...payload.rows],
        }));
      })
      .catch((error) => {
        console.error('Stock Signal Board load more failed:', error);
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }

  return (
    <StockSignalBoardView
      viewModel={viewModel}
      hasMore={Boolean(viewModel?.pagination?.hasMore)}
      isLoadingMore={loadingMore}
      onLoadMore={handleLoadMore}
    />
  );
}
