(function() {
  /**
   * Корректировка округления десятичных дробей.
   *
   * @param {String}  type  Тип корректировки.
   * @param {Number}  value Число.
   * @param {Integer} exp   Показатель степени (десятичный логарифм основания корректировки).
   * @returns {Number} Скорректированное значение.
   */
  function decimalAdjust(type, value, exp) {
    // Если степень не определена, либо равна нулю...
    if (typeof exp === 'undefined' || +exp === 0) {
      return Math[type](value);
    }
    value = +value;
    exp = +exp;
    // Если значение не является числом, либо степень не является целым числом...
    if (isNaN(value) || !(typeof exp === 'number' && exp % 1 === 0)) {
      return NaN;
    }
    // Сдвиг разрядов
    value = value.toString().split('e');
    value = Math[type](+(value[0] + 'e' + (value[1] ? (+value[1] - exp) : -exp)));
    // Обратный сдвиг
    value = value.toString().split('e');
    return +(value[0] + 'e' + (value[1] ? (+value[1] + exp) : exp));
  }

  // Десятичное округление к ближайшему
  if (!Math.round10) {
    Math.round10 = function(value, exp) {
      return decimalAdjust('round', value, exp);
    };
  }
  // Десятичное округление вниз
  if (!Math.floor10) {
    Math.floor10 = function(value, exp) {
      return decimalAdjust('floor', value, exp);
    };
  }
  // Десятичное округление вверх
  if (!Math.ceil10) {
    Math.ceil10 = function(value, exp) {
      return decimalAdjust('ceil', value, exp);
    };
  }
})();

const inputTableSelector = '#inputTable';

$(function () {
	changeTableSize(inputTableSelector);
});

$('#vertexesCount')
	.on('change', function () {
		changeTableSize(inputTableSelector);
	});

$('#inputData').on('submit', function (e) {
	e.preventDefault();
	return false;
});

$('#calculateBtn').on('click', function() {
	hideError();
	$('#parametersOutput').empty();

	let sumMatrix = getInputMatrix(inputTableSelector);

	// let sumMatrix = [
	// 	[0,0,3,0,0,0,0,0],
	// 	[3,0,3,3,2,3,0,0],
	// 	[0,0,0,2,3,3,0,0],
	// 	[3,0,1,0,3,3,0,0],
	// 	[3,1,0,0,0,3,0,0],
	// 	[3,0,0,0,0,0,0,0],
	// 	[3,3,3,3,3,3,0,3],
	// 	[3,3,3,3,3,3,0,0],
	// ];
	
	let estimation = new Estimation(sumMatrix);
	estimation.analyzeAndShow();
});

class Estimation {

	constructor(sumMatrix) {
		this.gamma = sumMatrix;
		this.m = 3;
		this.n = this.gamma.length; 
	}

	analyzeAndShow() {
		let C2n = this.n * (this.n - 1.0) / 2.0;
		let C2m = this.m * (this.m - 1.0) / 2.0;

		Estimation.#printParameter('C^2_n', C2n);
		Estimation.#printParameter('C^2_m', C2m);

		let D = 0.0;
		for (var i = 0; i < this.n; i++)
			for (var j = 0; j < i; j++)
				D += this.gamma[i][j] ** 2;

		let D_part2 = 0.0;
		for (var i = 0; i < this.n; i++)
			for (var j = 0; j < i; j++)
				D_part2 += this.gamma[i][j];

		D -= this.m * D_part2;
		D += C2m * C2n;
		Estimation.#printParameter('D', D);

		let K0 = D / (C2m * C2n);
		Estimation.#printParameter('K0', K0);

		let v = C2n * this.m * (this.m - 1.0) / (this.m - 2.0)**2;
		Estimation.#printParameter('Степени свободы (v)', v);

		const lambda = 1.64485363; // при alpha 0.05

		let X;
		let X_crit;
		if (v > 30) {
			X = 4 / (this.m - 2.0) * 
				(D - 0.5 * C2n * C2m * (this.m - 3.0) / (this.n - 2.0));
			Estimation.#printParameter('Статистика (Хнабл)', X);

			X_crit = v + lambda * Math.sqrt(2.0 * v) + 
				2.0/3.0 * (lambda**2 - 1) + 
				(lambda**3 - 7.0 * lambda) / (9.0 * Math.sqrt(2.0 * v));
			Estimation.#printParameter('Статистика (X^2кр)', X_crit);
			Estimation.#printParameter('=> Мнения экспертов', (X >= X_crit ? '' : 'не ') + 'cогласованы');
		} else {
			let X_crit = this.#getKhi_sq_crit(v, 0.05);
			Estimation.#printParameter('Статистика (Dнабл)', D);
			Estimation.#printParameter('Статистика (X^2кр)', X_crit);
			Estimation.#printParameter('=> Мнения экспертов', (D >= X_crit ? '' : 'не ') + 'cогласованы');
		}

		let yj = this.gamma.map(function (row) {
			return row.reduce(Estimation.#sumReduce)
		})
		Estimation.#printParameter('Суммарные числа предпочтений (y)', yj);
		let yjSum = yj.reduce(Estimation.#sumReduce);

		let betai = yj.map(y => y / yjSum);

		Estimation.#printParameter('Нормированные значения суммарных чисел предпочтения (beta_i)', betai);
	}

	static #printParameter(name, value) {
		if (typeof value === 'number')
			$('#parametersOutput').append('<p>- '+ name + ': <b>' + Math.round10(value, -4) +'</b></p>')
		
		else if (typeof value === 'string')
			$('#parametersOutput').append('<p>'+ name + ': <b>' + value +'</b></p>')
		
		else if (typeof value === 'object') { // только одномерный массив number
			value = value.map((el, i) => '' + Math.round10(el, -4)).join('&emsp;');

			$('#parametersOutput').append('<p>- '+ name + ':</p><p><b>' + value +'</b></p>')
		}
	}

	#getKhi_sq_crit(v, alpha) {
		const COLUMN_ID_MAP = new Map([[0.05, 2]]);

		if (Array.from(COLUMN_ID_MAP.keys())
				.every(x => !this.#isFloatEq(alpha, x))) {
			throw new Error('Неподдерживаемый уровень значимости');

		} else if (v <= 0 && v >= 31) {
			throw new Error('Поддерживаемое число степеней свободы в данной функции: от 1 до 30 вкл.');
		}

		const DOTS = [
			[6.6, 5.0, 3.8, 0.0039, 0.00098, 0.00016],
			[9.2, 7.4, 6.0, 0.103, 0.051, 0.020],
			[11.3, 9.4, 7.8, 0.352, 0.216, 0.115],
			[13.3, 11.1, 9.5, 0.711, 0.484, 0.297],
			[15.1, 12.8, 11.1, 1.15, 0.831, 0.554],
			[16.8, 14.4, 12.6, 1.64, 1.24, 0.872],
			[18.5, 16.0, 14.1, 2.17, 1.69, 1.24],
			[20.1, 17.5, 15.5, 2.73, 2.18, 1.65],
			[21.7, 19.0, 16.9, 3.33, 2.70, 2.09],
			[23.2, 20.5, 18.3, 3.94, 3.25, 2.56],
			[24.7, 21.9, 19.7, 4.57, 3.82, 3.05],
			[26.2, 23.3, 21.0, 5.23, 4.40, 3.57],
			[27.7, 24.7, 22.4, 5.89, 5.01, 4.11],
			[29.1, 26.1, 23.7, 6.57, 5.63, 4.66],
			[30.6, 27.5, 25.0, 7.26, 6.26, 5.23],
			[32.0, 28.8, 26.3, 7.96, 6.91, 5.81],
			[33.4, 30.2, 27.6, 8.67, 7.56, 6.41],
			[34.8, 31.5, 28.9, 9.39, 8.23, 7.01],
			[36.2, 32.9, 30.1, 10.1, 8.91, 7.63],
			[37.6, 34.2, 31.4, 10.9, 9.59, 8.26],
			[38.9, 35.5, 32.7, 11.6, 10.3, 8.90],
			[40.3, 36.8, 33.9, 12.3, 11.0, 9.54],
			[41.6, 38.1, 35.2, 13.1, 11.7, 10.2],
			[43.0, 39.4, 36.4, 13.8, 12.4, 10.9],
			[44.3, 40.6, 37.7, 14.6, 13.1, 11.5],
			[45.6, 41.9, 38.9, 15.4, 13.8, 12.2],
			[47.0, 43.2, 40.1, 16.2, 14.6, 12.9],
			[48.3, 44.5, 41.3, 16.9, 15.3, 13.6],
			[49.6, 45.7, 42.6, 17.7, 16.0, 14.3],
			[50.9, 47.0, 43.8, 18.5, 16.8, 15.0]
		];

		return DOTS[v][COLUMN_ID_MAP.get(alpha)];
	}

	#isFloatEq(a, b) {
		return Math.abs(a-b) < 0.000001;
	}

	static #sumReduce(acc, x) {
		return acc + x;
	}
}

function new2DZerosArray(rowsCount, colsCount) {
	let array = new Array(rowsCount);
	for (var i = 0; i < rowsCount; i++) {
		array[i] = new Array(colsCount).fill(0);
	}
	return array;
}

function changeTableSize (tableSelector) {
	let $rows = $(tableSelector).find('.table__content').find('tr');
	let $topSignature = $(tableSelector).find('.table__top-signature');
	let $leftSignature = $(tableSelector).find('.table__left-signature');
	let oldVertexesCount = $rows.length;
	let newVertexesCount = parseInt($('#vertexesCount').val());

	if (newVertexesCount < 2 || newVertexesCount > 16)
		return;

	if (newVertexesCount < oldVertexesCount) { // Нужно удалять ячейки
		for (var i = newVertexesCount; i < oldVertexesCount; i++)
			$rows[i].remove();

		$rows.each(function (i) {
			let row = $(this).find('td');
			row.slice(-(row.length-newVertexesCount)).remove();
		});

		$topSignature.children().slice(-(oldVertexesCount-newVertexesCount)).remove()
		$leftSignature.children().slice(-(oldVertexesCount-newVertexesCount)).remove()

	} else {
		let newCount = newVertexesCount - oldVertexesCount;

		// берем любую строку и копируем
		let newRow = $rows.first().clone(); 
		newRow.find('input').val(0);
		let elem = $(newRow).find('td').first();

		for (var i = 0; i < newCount; i++)
			elem.clone().appendTo(newRow);

		for (var i = 0; i < newCount; i++)
			newRow.clone().appendTo(tableSelector + ' .table__content');

		for (var i = 0; i < newCount; i++)
			elem.clone().appendTo($rows);

		let $signatureElem = $topSignature.children().first();
		for (var i = $topSignature.children().length+1; i <= newVertexesCount; i++) {
			let $newSignatureElem = $signatureElem.clone();
			$newSignatureElem.text('o'+i);
			$newSignatureElem.clone().appendTo($topSignature);
			$newSignatureElem.clone().appendTo($leftSignature);
		}
	}
}

function getInputMatrix(tableSelector) {
	return $(tableSelector).find('.table__content').find('tr').toArray()
		.map(function (row) {
			return $(row).find('input').toArray()
				.map(function (elem) {
					return parseInt(elem.value);
				});
		});
}

const $tableRow = $('<tr class="horizontal table__row"></tr>');
const $tableCell = $('<td class="table__cell"></td>');

function showMatrix(matrix, tableSelector) {
	let $table = $(tableSelector);
	let $matrix = $table.find('.table__content');
	let $topSignature = $table.find('.table__top-signature');
	let $leftSignature = $table.find('.table__left-signature');
	$matrix.empty();
	$topSignature.empty();
	$leftSignature.empty();

	matrix.forEach(function (row) {
		let $newRow = $tableRow.clone();
		$newRow.appendTo($matrix);

		row.forEach(function (number) {
			let $newCell = $tableCell.clone();
			$newCell.text(String(number));
			$newCell.appendTo($newRow);
		})
	})

	for (var i = 1; i <= matrix.length; i++) {
		let $newLabel = $(document.createElement('label'));
		$newLabel.text('v'+i)
		$newLabel.appendTo($leftSignature);
	}

	for (var i = 1; i <= matrix[0].length; i++) {
		let $newLabel = $(document.createElement('label'));
		$newLabel.text('v'+i)
		$newLabel.appendTo($topSignature);
	}

	$table.css('display', 'block');
}

function showError(message) {
	$('#error').find('p').text(message);
	$('#error').css('display', 'block');
}

function hideError() {
	$('#error').css('display', 'none');
}