document.addEventListener('DOMContentLoaded', () => {
	const table = document.getElementById('items-table');
	if (!table) {
		console.warn('No element with id "items-table" found. Aborting app.js initialization.');
		return;
	}
	const tbody = table.querySelector('tbody');
	if (!tbody) {
		console.warn('No <tbody> inside #items-table found. Aborting.');
		return;
	}
	const totalEl = document.getElementById('total') || { textContent: '' };
	const summaryText = document.getElementById('summary-text') || { textContent: '' };
	let formatAsPercent = false;

	function formatNumberForDisplay(n, percent = false) {
		if (percent) {
			return (
				new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2, useGrouping: false }).format(n) +
				' %'
			);
		}
		return new Intl.NumberFormat('de-DE').format(n);
	}

	function parseIntSafe(v) {
		const n = parseInt(v, 10);
		return Number.isFinite(n) ? Math.max(0, n) : 0;
	}

	function recompute() {
		let sum = 0;
		const rows = tbody.querySelectorAll('tr');
		rows.forEach((row) => {
			const cb = row.querySelector('.row-check');
			const countInp = row.querySelector('.row-count');
			const valueCell = row.querySelector('.value');
			if (!cb || !countInp || !valueCell) return;
			const count = parseIntSafe(countInp.value);
			const dataVal = row.getAttribute('data-value');
			const base = dataVal ? parseIntSafe(dataVal) : parseIntSafe(valueCell.textContent);
			const rowTotal = cb.checked ? base * count : 0;
			// display per-row total, formatted as percent if needed
			valueCell.textContent = formatNumberForDisplay(rowTotal, formatAsPercent);
			sum += rowTotal;
		});
		totalEl.textContent = formatNumberForDisplay(sum, formatAsPercent);
	}

	// dynamic row creation and listeners
	function sanitizeNumberInput(input) {
		input.addEventListener('input', (e) => {
			const val = e.target.value;
			if (val === '') return;
			const digits = val.replace(/[^0-9]/g, '');
			if (digits !== val) e.target.value = digits;
		});
		input.addEventListener('change', recompute);
		input.addEventListener('keyup', recompute);
	}

	function attachRowListeners(row) {
		const cb = row.querySelector('.row-check');
		const countInp = row.querySelector('.row-count');
		// only attach change listener when checkbox is enabled
		if (cb && !cb.disabled) cb.addEventListener('change', recompute);
		// only attach input listeners when the field is editable
		if (countInp && !countInp.hasAttribute('readonly')) sanitizeNumberInput(countInp);
	}

	function createRow({
		desc = '',
		value = 0,
		count = 0,
		checked = false,
		tip = '',
		countEditable = true,
		selectable = true,
	} = {}) {
		const tr = document.createElement('tr');
		tr.setAttribute('data-value', String(value));
		tr.innerHTML = `
			<td><input type="checkbox" class="row-check" ${checked ? 'checked' : ''} ${
			selectable ? '' : 'disabled'
		}></td>
			<td><input type="number" class="row-count" min="0" step="1" value="${parseIntSafe(
				count
			)}" inputmode="numeric" pattern="\\d*" ${
			countEditable ? '' : 'readonly tabindex="-1" aria-readonly="true"'
		}></td>
			<td class="desc">${escapeHtml(desc)} <span class="info" data-tip="${escapeHtml(tip)}">i</span></td>
			<td class="value">0</td>
		`;
		tbody.appendChild(tr);
		// set initial computed value for the row
		const valueCell = tr.querySelector('.value');
		const countInp = tr.querySelector('.row-count');
		const cb = tr.querySelector('.row-check');
		const base = parseIntSafe(String(value));
		const initialCount = parseIntSafe(countInp ? countInp.value : count);
		if (valueCell) {
			const initialTotal = cb && cb.checked ? base * initialCount : 0;
			valueCell.textContent = formatNumberForDisplay(initialTotal, formatAsPercent);
		}
		attachRowListeners(tr);
		return tr;
	}

	// Attach to any existing rows (if present in DOM)
	tbody.querySelectorAll('tr').forEach(attachRowListeners);

	// load from JSON (supports either an array of items or an object with metadata)
	async function loadFromFile(url = 'penetration.json') {
		try {
			const res = await fetch(url, { cache: 'no-store' });
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const data = await res.json();

			// Determine structure: either an array of items, or an object { items: [...], formatAsPercent: true }
			let items = [];
			if (Array.isArray(data)) {
				items = data;
			} else if (data && Array.isArray(data.items)) {
				items = data.items;
				// allow JSON to control percent formatting
				if ('formatAsPercent' in data) {
					formatAsPercent = !!data.formatAsPercent;
					summaryText.textContent = data.summaryText || 'Gesamtsumme: ';
					titleEl.textContent = data.title;
				} else if (data.meta && 'formatAsPercent' in data.meta) {
					formatAsPercent = !!data.meta.formatAsPercent;
					summaryText.textContent = data.meta.summaryText || 'Gesamtsumme: ';
					titleEl.textContent = data.meta.title;
				}
			} else {
				console.warn('Unexpected JSON structure in', url);
				return;
			}

			tbody.innerHTML = '';
			items.forEach((item) =>
				createRow({
					desc: item.desc,
					value: item.value,
					count: item.count,
					checked: item.checked,
					tip: item.tip,
					countEditable: 'countEditable' in item ? item.countEditable : true,
					selectable: 'selectable' in item ? item.selectable : true,
				})
			);

			recompute();
		} catch (err) {
			console.warn(
				'Could not load',
				url,
				'— falling back to embedded rows or default. Error:',
				err
			);
		}
	}

	// list selector buttons (if present)
	const btnListPen = document.getElementById('btn-list-pen');
	const btnListCritDamage = document.getElementById('btn-list-critdamage');
	const btnListWeaponDamage = document.getElementById('btn-list-weapondamage');

	const titleEl = document.querySelector('h1');

	async function loadAndSet(file, activeBtn) {
		await loadFromFile(file);

		if (btnListPen) {
			btnListPen.classList.toggle('active', btnListPen === activeBtn);
		}
		if (btnListCritDamage) {
			btnListCritDamage.classList.toggle('active', btnListCritDamage === activeBtn);
		}
		if (btnListWeaponDamage) {
			btnListWeaponDamage.classList.toggle('active', btnListWeaponDamage === activeBtn);
		}
	}

	if (btnListPen) {
		btnListPen.addEventListener('click', () => loadAndSet('penetration.json', btnListPen));
	}
	if (btnListCritDamage) {
		btnListCritDamage.addEventListener('click', () =>
			loadAndSet('criticalDamage.json', btnListCritDamage)
		);
	}
	if (btnListWeaponDamage) {
		btnListWeaponDamage.addEventListener('click', () =>
			loadAndSet('weaponDamage.json', btnListWeaponDamage)
		);
	}

	// initial auto-load default list
	loadAndSet('penetration.json', btnListPen);
});

// small helper: escape text for insertion into innerHTML
function escapeHtml(s) {
	if (!s) return '';
	return String(s).replace(/[&<>"']/g, function (c) {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
	});
}
