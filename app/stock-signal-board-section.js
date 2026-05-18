import { getStockSignalBoardRows } from '../lib/repositories/stock-signal-board.js';
import { buildStockSignalBoardViewModel } from '../lib/utils/stock-signal-board-view.js';
import { StockSignalBoardView } from './stock-signal-board-view.js';

export default async function StockSignalBoardSection() {
  const rows = await getStockSignalBoardRows();
  const viewModel = buildStockSignalBoardViewModel(rows);

  if (!viewModel.rows.length) {
    return null;
  }

  return <StockSignalBoardView viewModel={viewModel} />;
}
