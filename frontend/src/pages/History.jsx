
import { useMemo, useState } from 'react';
import {
  Search,
  History as HistoryIcon,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ArrowUpRight,
  FileImage,
  X,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';

function readHistory() {
  try {
    const data = JSON.parse(localStorage.getItem('lsdHistory') || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString();
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
}

function resultLabel(prediction) {
  if (prediction === 'Infected') return 'Needs veterinary review';
  if (prediction === 'Healthy') return 'No signs detected';
  if (prediction === 'Invalid Image') return 'Invalid image';
  return prediction || 'Unknown';
}

function confidenceLabel(confidence) {
  if (confidence === null || confidence === undefined || confidence === '') {
    return 'Not provided';
  }

  const value = Number(confidence);
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : 'Not provided';
}

export default function History() {
  const [records, setRecords] = useState(readHistory);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [detail, setDetail] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredRecords = useMemo(() => {
    const search = query.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch = [
        record.cow,
        record.id,
        record.prediction,
        record.message,
      ].some((value) => String(value || '').toLowerCase().includes(search));

      const matchesFilter =
        filter === 'All' || filter === record.prediction;

      return matchesSearch && matchesFilter;
    });
  }, [records, query, filter]);

  const needsReview = records.filter(
    (record) => record.prediction === 'Infected'
  ).length;

  const noSigns = records.filter(
    (record) => record.prediction === 'Healthy'
  ).length;

  function clearHistory() {
    try {
      localStorage.removeItem('lsdHistory');
      setRecords([]);
      setDetail(null);
      setShowClearConfirm(false);
    } catch {
      setShowClearConfirm(false);
    }
  }

  function deleteRecord(recordId) {
    const updated = records.filter((record) => record.id !== recordId);

    try {
      localStorage.setItem('lsdHistory', JSON.stringify(updated));
      setRecords(updated);
      setDetail(null);
    } catch (error) {
      console.error('Could not update screening history:', error);
    }
  }

  return (
    <div className="page">
      <div className="page-title">
        <span className="eyebrow">YOUR SCREENING RECORDS</span>
        <h1>Screening history</h1>
        <p>Review screening results, timestamps and model confidence where provided.</p>
      </div>

      <div className="stats">
        <div className="stat">
          <HistoryIcon />
          <small>Total records</small>
          <b>{records.length}</b>
        </div>

        <div className="stat">
          <AlertTriangle />
          <small>Needs review</small>
          <b>{needsReview}</b>
        </div>

        <div className="stat">
          <CheckCircle2 />
          <small>No signs detected</small>
          <b>{noSigns}</b>
        </div>
      </div>

      <section className="card history-card">
        <div className="tools">
          <label className="search">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cow, record ID or result"
              aria-label="Search screening records"
            />
          </label>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter by result"
          >
            <option value="All">All results</option>
            <option value="Infected">Needs review</option>
            <option value="Healthy">No signs detected</option>
            <option value="Invalid Image">Invalid image</option>
            <option value="Unknown">Unknown</option>
          </select>

          <button
            type="button"
            className="btn danger"
            onClick={() => setShowClearConfirm(true)}
            disabled={!records.length}
          >
            <Trash2 size={16} />
            Clear history
          </button>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="empty">
            <FileImage size={34} />

            <h3>
              {records.length
                ? 'No matching records'
                : 'No screening records yet'}
            </h3>

            <p>
              {records.length
                ? 'Try another search term or filter.'
                : 'Successful screening results will appear here after the API integration is working.'}
            </p>

            <Link className="btn primary" to="/app/detect">
              Start screening
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cow / record</th>
                  <th>Date &amp; time</th>
                  <th>Result</th>
                  <th>Confidence</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <b>{record.cow || 'Cow not specified'}</b>
                      <small>{record.id || 'No record ID'}</small>
                    </td>

                    <td>
                      {formatDate(record.timestamp)}
                      <small>{formatTime(record.timestamp)}</small>
                    </td>

                    <td>
                      <span
                        className={`pill ${
                          record.prediction === 'Infected'
                            ? 'warn'
                            : record.prediction === 'Healthy'
                              ? 'good'
                              : ''
                        }`}
                      >
                        {resultLabel(record.prediction)}
                      </span>
                    </td>

                    <td>{confidenceLabel(record.confidence)}</td>

                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setDetail(record)}
                        title="View details"
                        aria-label={`View details for ${record.id || 'record'}`}
                      >
                        <ArrowUpRight />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted-note">
          Records are stored in this browser only. This demo is not a clinical
          record system.
        </p>
      </section>

      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row">
              <h2 id="history-detail-title">Screening details</h2>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setDetail(null)}
                aria-label="Close details"
              >
                <X />
              </button>
            </div>

            {detail.image && (
              <img
                className="detail-image"
                src={detail.image}
                alt="Screened cattle"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            )}

            <p><b>Record:</b> {detail.id || 'Not available'}</p>
            <p><b>Cow:</b> {detail.cow || 'Cow not specified'}</p>
            <p><b>Date:</b> {formatDate(detail.timestamp)}</p>
            <p><b>Time:</b> {formatTime(detail.timestamp)}</p>
            <p><b>Model output:</b> {resultLabel(detail.prediction)}</p>
            <p><b>Confidence:</b> {confidenceLabel(detail.confidence)}</p>

            {detail.message && (
              <p><b>Message:</b> {detail.message}</p>
            )}

            <div className="notice">
              <ShieldAlert size={18} />
              <span>
                This is a preliminary screening output, not a veterinary
                diagnosis. Contact a veterinarian if the animal shows
                concerning signs.
              </span>
            </div>

            <div className="row">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setDetail(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="btn danger"
                onClick={() => deleteRecord(detail.id)}
              >
                <Trash2 size={16} />
                Delete record
              </button>
            </div>
          </section>
        </div>
      )}

      {showClearConfirm && (
        <div
          className="overlay"
          onClick={() => setShowClearConfirm(false)}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="row">
              <h2 id="clear-history-title">Clear screening history?</h2>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowClearConfirm(false)}
                aria-label="Close confirmation"
              >
                <X />
              </button>
            </div>

            <p>
              This removes all screening records saved in this browser.
              This action cannot be undone.
            </p>

            <div className="row">
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn danger"
                onClick={clearHistory}
              >
                <Trash2 size={16} />
                Yes, clear history
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
