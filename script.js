// ============================================================
//  ตัวแปร Global (ตัวแปรที่ทุกฟังก์ชันเรียกใช้ร่วมกันได้)
// ============================================================
var mode = "min";        // โหมดที่เลือก: "min" = ต้นทุนต่ำสุด, "max" = กำไรสูงสุด
var rowCount = 0;        // จำนวนแถว (Supply) ที่ผู้ใช้กรอก (ยังไม่รวม Dummy)
var colCount = 0;        // จำนวนคอลัมน์ (Demand) ที่ผู้ใช้กรอก (ยังไม่รวม Dummy)

var cost = [];           // ตารางต้นทุน/กำไร (หลังเติม Dummy แล้ว)
var supply = [];         // ปริมาณ Supply ของแต่ละแถว (หลังเติม Dummy แล้ว)
var demand = [];         // ปริมาณ Demand ของแต่ละคอลัมน์ (หลังเติม Dummy แล้ว)
var numR = 0;            // จำนวนแถวจริงที่ใช้คำนวณ (รวม Dummy)
var numC = 0;            // จำนวนคอลัมน์จริงที่ใช้คำนวณ (รวม Dummy)
var dummyRow = -1;       // ลำดับแถวที่เป็น Dummy (-1 แปลว่าไม่มี)
var dummyCol = -1;       // ลำดับคอลัมน์ที่เป็น Dummy (-1 แปลว่าไม่มี)
var balanceMessage = ""; // ข้อความบอกว่าสมดุลหรือไม่

var alloc = [];          // ตารางผลการจัดสรรสินค้า (จำนวนที่ส่งในแต่ละช่อง)
var basic = [];          // ตาราง true/false บอกว่าช่องนั้นเป็น "ช่องที่ใช้งาน" (Basic cell) หรือเปล่า
var nwDone = false;      // บอกว่าทำ Northwest Corner เสร็จแล้วหรือยัง

var loopR = [];          // เก็บเลขแถวของแต่ละจุดในเส้น Closed Loop
var loopC = [];          // เก็บเลขคอลัมน์ของแต่ละจุดในเส้น Closed Loop
var loopLen = 0;         // จำนวนจุดทั้งหมดในเส้น Closed Loop


// ============================================================
//  Step 1 -> 2 : สร้างตารางให้กรอกข้อมูล
// ============================================================
function createTable() {
  // อ่านจำนวนแถวและคอลัมน์จากช่องกรอก (Number() แปลงข้อความเป็นตัวเลข)
  rowCount = Number(document.getElementById("supplyCount").value);
  colCount = Number(document.getElementById("demandCount").value);

  // ตรวจว่าเป็นจำนวนเต็มระหว่าง 1 ถึง 8 หรือไม่
  if (rowCount < 1 || rowCount > 8 || colCount < 1 || colCount > 8 ||
      rowCount != Math.floor(rowCount) || colCount != Math.floor(colCount)) {
    alert("กรุณากรอกจำนวนเป็นจำนวนเต็ม 1 ถึง 8");
    rowCount = 0;
    colCount = 0;
    return;
  }

  // สร้างข้อความ HTML ของตารางต่อกันไปเรื่อยๆ ในตัวแปร html
  var html = "<div class='table-wrap'><table>";

  // --- แถวหัวตาราง ---
  html = html + "<tr><th></th>";
  for (var j = 0; j < colCount; j++) {
    html = html + "<th>Demand " + (j + 1) + "</th>";
  }
  html = html + "<th>Supply</th></tr>";

  // --- แถวข้อมูล (ช่องค่าขนส่ง/กำไร + ช่อง Supply ขวาสุด) ---
  for (var i = 0; i < rowCount; i++) {
    html = html + "<tr><th>Source " + (i + 1) + "</th>";
    for (var j = 0; j < colCount; j++) {
      // id ของช่อง เช่น c_0_1 = ช่องแถว 0 คอลัมน์ 1
      html = html + "<td><input type='number' id='c_" + i + "_" + j + "'></td>";
    }
    html = html + "<td><input type='number' id='s_" + i + "'></td></tr>";
  }

  // --- แถวล่างสุด (ช่อง Demand) ---
  html = html + "<tr><th>Demand</th>";
  for (var j = 0; j < colCount; j++) {
    html = html + "<td><input type='number' id='d_" + j + "'></td>";
  }
  html = html + "<td></td></tr>";

  html = html + "</table></div>";
  html = html + "<div class='info'>ช่องในตาราง = ค่าขนส่งต่อหน่วย (โหมด Minimize) หรือ กำไรต่อหน่วย (โหมด Maximize)</div>";

  // เอาข้อความ HTML ไปใส่ในหน้าเว็บ
  document.getElementById("inputArea").innerHTML = html;

  // ล้างผลลัพธ์เก่า และรีเซ็ตสถานะ
  document.getElementById("resultNW").innerHTML = "";
  document.getElementById("resultSS").innerHTML = "";
  nwDone = false;
}


// ============================================================
//  อ่านข้อมูลจากตาราง + ตรวจความสมดุล + เติม Dummy
//  คืนค่า true ถ้าอ่านสำเร็จ, false ถ้าข้อมูลไม่ครบ/ไม่ถูกต้อง
// ============================================================
function readData() {
  // ถ้ายังไม่ได้สร้างตาราง ให้แจ้งเตือน
  if (rowCount == 0 || colCount == 0) {
    alert("กรุณากดปุ่ม 'สร้างตาราง' ก่อน");
    return false;
  }

  // --- อ่านโหมดที่เลือกจากปุ่ม Radio ---
  var radios = document.getElementsByName("mode");
  for (var r = 0; r < radios.length; r++) {
    if (radios[r].checked == true) {
      mode = radios[r].value;
    }
  }

  // --- อ่านค่าขนส่ง/กำไร ---
  var tempCost = [];
  for (var i = 0; i < rowCount; i++) {
    tempCost[i] = [];
    for (var j = 0; j < colCount; j++) {
      var text = document.getElementById("c_" + i + "_" + j).value;
      if (text === "" || isNaN(Number(text))) {
        alert("กรุณากรอกค่าขนส่ง/กำไรให้ครบทุกช่อง (Source " + (i + 1) + ", Demand " + (j + 1) + ")");
        return false;
      }
      tempCost[i][j] = Number(text);
    }
  }

  // --- อ่านค่า Supply (ขวาสุด) ---
  var tempSupply = [];
  var sumSupply = 0;
  for (var i = 0; i < rowCount; i++) {
    var text = document.getElementById("s_" + i).value;
    if (text === "" || isNaN(Number(text)) || Number(text) < 0) {
      alert("กรุณากรอก Supply ของ Source " + (i + 1) + " เป็นตัวเลขที่ไม่ติดลบ");
      return false;
    }
    tempSupply[i] = Number(text);
    sumSupply = sumSupply + tempSupply[i];   // รวมค่า Supply ทั้งหมด
  }

  // --- อ่านค่า Demand (ล่างสุด) ---
  var tempDemand = [];
  var sumDemand = 0;
  for (var j = 0; j < colCount; j++) {
    var text = document.getElementById("d_" + j).value;
    if (text === "" || isNaN(Number(text)) || Number(text) < 0) {
      alert("กรุณากรอก Demand ของ Demand " + (j + 1) + " เป็นตัวเลขที่ไม่ติดลบ");
      return false;
    }
    tempDemand[j] = Number(text);
    sumDemand = sumDemand + tempDemand[j];   // รวมค่า Demand ทั้งหมด
  }

  // --- คัดลอกข้อมูลไปใส่ตัวแปรหลัก (cost, supply, demand) ---
  cost = [];
  supply = [];
  demand = [];
  for (var i = 0; i < rowCount; i++) {
    cost[i] = [];
    for (var j = 0; j < colCount; j++) {
      cost[i][j] = tempCost[i][j];
    }
    supply[i] = tempSupply[i];
  }
  for (var j = 0; j < colCount; j++) {
    demand[j] = tempDemand[j];
  }
  numR = rowCount;
  numC = colCount;
  dummyRow = -1;
  dummyCol = -1;

  // --- เช็กความสมดุลและเติม Dummy ---
  if (sumSupply > sumDemand) {
    // Supply มากกว่า Demand -> เติม Dummy Column (จุดรับสินค้าสมมติ) ให้รับส่วนที่เกิน
    for (var i = 0; i < numR; i++) {
      cost[i][numC] = 0;                       // ค่าในช่อง Dummy เป็น 0 ทั้งหมด
    }
    demand[numC] = sumSupply - sumDemand;      // Demand ของ Dummy = ส่วนต่าง
    dummyCol = numC;                           // จำไว้ว่าคอลัมน์ไหนคือ Dummy
    numC = numC + 1;                           // จำนวนคอลัมน์เพิ่มขึ้น 1
    balanceMessage = "Supply (" + sumSupply + ") มากกว่า Demand (" + sumDemand + ") -> เติม Dummy Column";
  } else if (sumDemand > sumSupply) {
    // Demand มากกว่า Supply -> เติม Dummy Row (แหล่งผลิตสมมติ) ให้ส่งส่วนที่ขาด
    cost[numR] = [];
    for (var j = 0; j < numC; j++) {
      cost[numR][j] = 0;                       // ค่าในช่อง Dummy เป็น 0 ทั้งหมด
    }
    supply[numR] = sumDemand - sumSupply;      // Supply ของ Dummy = ส่วนต่าง
    dummyRow = numR;                           // จำไว้ว่าแถวไหนคือ Dummy
    numR = numR + 1;                           // จำนวนแถวเพิ่มขึ้น 1
    balanceMessage = "Demand (" + sumDemand + ") มากกว่า Supply (" + sumSupply + ") -> เติม Dummy Row";
  } else {
    balanceMessage = "Supply = Demand = " + sumSupply + " (ตารางสมดุลอยู่แล้ว ไม่ต้องเติม Dummy)";
  }

  return true;
}


// ============================================================
//  ขั้นแรก: Northwest Corner
// ============================================================
function calculateNorthwest() {
  // อ่านข้อมูลก่อน ถ้าอ่านไม่สำเร็จให้หยุดทำงาน
  if (readData() == false) {
    return;
  }

  // สร้างตาราง alloc (จำนวนที่ส่ง) และ basic (ช่องที่ใช้งาน) ให้เป็นค่าเริ่มต้น
  alloc = [];
  basic = [];
  for (var i = 0; i < numR; i++) {
    alloc[i] = [];
    basic[i] = [];
    for (var j = 0; j < numC; j++) {
      alloc[i][j] = 0;
      basic[i][j] = false;
    }
  }

  // ทำสำเนา supply/demand ไว้หักลบ (จะได้ไม่ทำให้ค่าตั้งต้นเสีย)
  var sLeft = [];
  var dLeft = [];
  for (var i = 0; i < numR; i++) { sLeft[i] = supply[i]; }
  for (var j = 0; j < numC; j++) { dLeft[j] = demand[j]; }

  // เริ่มที่ช่องซ้ายบนสุด (แถว 0 คอลัมน์ 0)
  var i = 0;
  var j = 0;

  // วนลูปจนกว่าจะเดินออกนอกตาราง
  while (i < numR && j < numC) {
    // จำนวนที่ส่งได้ = ค่าน้อยกว่าระหว่างของที่เหลือในแถว กับ ความต้องการที่เหลือในคอลัมน์
    var amount = sLeft[i];
    if (dLeft[j] < amount) {
      amount = dLeft[j];
    }

    alloc[i][j] = amount;        // บันทึกจำนวนที่ส่งลงช่องนี้
    basic[i][j] = true;          // ช่องนี้เป็นช่องที่ใช้งาน
    sLeft[i] = sLeft[i] - amount;   // หักของที่เหลือในแถว
    dLeft[j] = dLeft[j] - amount;   // หักความต้องการที่เหลือในคอลัมน์

    // ตัดสินใจว่าจะเขยิบลงล่างหรือไปทางขวา
    if (sLeft[i] == 0 && dLeft[j] == 0) {
      // กรณีหมดพร้อมกัน (Degenerate): เขยิบทีละทิศเดียว เพื่อให้ได้ช่องใช้งานครบ (แถว+คอลัมน์-1)
      if (i < numR - 1) {
        i = i + 1;
      } else {
        j = j + 1;
      }
    } else if (sLeft[i] == 0) {
      i = i + 1;                 // Supply แถวนี้หมด -> ลงล่าง
    } else {
      j = j + 1;                 // Demand คอลัมน์นี้ครบ -> ไปขวา
    }
  }

  nwDone = true;

  // แสดงผล
  var total = calculateTotal(alloc);
  var html = "<h3>ผลจาก Northwest Corner</h3>";
  html = html + "<div class='info'>" + balanceMessage + "</div>";
  html = html + buildResultTable(alloc, basic);
  html = html + "<div class='total-box'>ผลรวมจาก Northwest Corner = " + total + " (ยังไม่ใช่ค่าที่ดีที่สุด)</div>";
  document.getElementById("resultNW").innerHTML = html;
  document.getElementById("resultSS").innerHTML = "";   // ล้างผล Stepping Stone เก่า
}


// ============================================================
//  ขั้นสุดท้าย: Stepping Stone
// ============================================================
function calculateSteppingStone() {
  // ต้องทำ Northwest Corner ก่อน
  if (nwDone == false) {
    alert("กรุณากดปุ่ม 'คำนวณขั้นแรก (Northwest Corner)' ก่อน");
    return;
  }

  // ทำสำเนาผลของ Northwest Corner ไปปรับปรุงต่อ (จะได้ไม่ทับผลขั้นแรก)
  var a2 = [];
  var b2 = [];
  for (var i = 0; i < numR; i++) {
    a2[i] = [];
    b2[i] = [];
    for (var j = 0; j < numC; j++) {
      a2[i][j] = alloc[i][j];
      b2[i][j] = basic[i][j];
    }
  }

  var round = 0;           // นับจำนวนรอบที่ปรับปรุง
  var finished = false;    // true เมื่อได้คำตอบที่ดีที่สุดแล้ว
  var stepsHtml = "";      // เก็บ HTML อธิบายการปรับปรุง "ทีละรอบ"
  var startTotal = calculateTotal(a2);              // ผลรวมก่อนเริ่มปรับปรุง
  var goodWord = "ต้นทุน";                          // คำที่ใช้อธิบาย (ต้นทุน / กำไร)
  if (mode == "max") {
    goodWord = "กำไร";
  }

  // วนลูปปรับปรุงจนกว่าจะดีที่สุด (จำกัดไม่เกิน 100 รอบ กันลูปไม่รู้จบ)
  while (finished == false && round < 100) {

    // --- หาช่องว่างที่ "ควรโยกของมาใส่" มากที่สุด ---
    var bestI = -1;        // แถวของช่องที่ดีที่สุด (-1 = ยังไม่เจอ)
    var bestJ = -1;        // คอลัมน์ของช่องที่ดีที่สุด
    var bestIndex = 0;     // ค่าดัชนีของช่องที่ดีที่สุด (เริ่มที่ 0 คือต้องดีกว่า 0 เท่านั้น)

    // เก็บดัชนีของ "ทุกช่องว่าง" ไว้แสดงในคำอธิบาย
    var evalI = [];
    var evalJ = [];
    var evalV = [];

    for (var i = 0; i < numR; i++) {
      for (var j = 0; j < numC; j++) {
        if (b2[i][j] == false) {                 // เลือกเฉพาะ "ช่องว่าง"
          var len = findLoop(i, j, b2);          // ลากเส้น Closed Loop จากช่องว่างนี้
          if (len > 0) {
            // คำนวณ Evaluation Index: จุดตำแหน่งคู่ (0,2,4..) บวก, ตำแหน่งคี่ (1,3,5..) ลบ
            var index = 0;
            for (var k = 0; k < len; k++) {
              if (k % 2 == 0) {
                index = index + cost[loopR[k]][loopC[k]];
              } else {
                index = index - cost[loopR[k]][loopC[k]];
              }
            }

            // จดดัชนีของช่องนี้ไว้
            evalI.push(i);
            evalJ.push(j);
            evalV.push(index);

            // โหมด Minimize: เอาดัชนีติดลบมากที่สุด / โหมด Maximize: เอาดัชนีบวกมากที่สุด
            if (mode == "min") {
              if (index < bestIndex) {
                bestIndex = index;
                bestI = i;
                bestJ = j;
              }
            } else {
              if (index > bestIndex) {
                bestIndex = index;
                bestI = i;
                bestJ = j;
              }
            }
          }
        }
      }
    }

    // --- ถ้าไม่เจอช่องที่ดีขึ้นเลย แปลว่าได้คำตอบที่ดีที่สุดแล้ว ---
    if (bestI == -1) {
      finished = true;

      // บันทึกรอบสุดท้าย: ตรวจแล้วไม่มีช่องไหนทำให้ดีขึ้นอีก
      stepsHtml = stepsHtml + "<div class='round-box round-done'>";
      stepsHtml = stepsHtml + "<h4>ตรวจสอบรอบสุดท้าย</h4>";
      stepsHtml = stepsHtml + "<div class='info'>ดัชนีของช่องว่างทุกช่อง: " + buildEvalList(evalI, evalJ, evalV, -1, -1) + "</div>";
      if (mode == "min") {
        stepsHtml = stepsHtml + "<div class='info'>ไม่มีช่องไหนที่ดัชนีติดลบ -> โยกต่อไปก็ไม่ทำให้ต้นทุนลดลงอีก จึงได้คำตอบที่ดีที่สุดแล้ว</div>";
      } else {
        stepsHtml = stepsHtml + "<div class='info'>ไม่มีช่องไหนที่ดัชนีเป็นบวก -> โยกต่อไปก็ไม่ทำให้กำไรเพิ่มอีก จึงได้คำตอบที่ดีที่สุดแล้ว</div>";
      }
      stepsHtml = stepsHtml + "</div>";
    } else {
      // --- โยกของตามเส้น Closed Loop ของช่องที่ดีที่สุด ---
      findLoop(bestI, bestJ, b2);      // ลากเส้นอีกครั้งเพื่อให้ loopR, loopC เป็นของช่องนี้

      // หา theta = ค่าน้อยที่สุดในจุดตำแหน่งคี่ (จุดที่ต้องลบ)
      var theta = 999999999;
      for (var k = 1; k < loopLen; k = k + 2) {
        if (a2[loopR[k]][loopC[k]] < theta) {
          theta = a2[loopR[k]][loopC[k]];
        }
      }

      // --- เตรียมข้อมูลอธิบาย (ทำก่อนโยกของ เพราะหลังโยกค่าจะเปลี่ยน) ---
      var totalBefore = calculateTotal(a2);

      // marks = ตารางเครื่องหมาย + / - ของแต่ละช่องในเส้น Closed Loop (ช่องอื่นเป็นค่าว่าง)
      var marks = [];
      for (var i = 0; i < numR; i++) {
        marks[i] = [];
        for (var j = 0; j < numC; j++) {
          marks[i][j] = "";
        }
      }
      var pathText = "";      // ข้อความเส้นทาง เช่น Source 1/Demand 2 (+)
      var formula = "";       // สูตรคำนวณดัชนี เช่น +5 -3 +4 -2
      var minusText = "";     // รายการจำนวนในช่องที่ต้องลบ ใช้อธิบาย theta
      for (var k = 0; k < loopLen; k++) {
        var sign = "-";
        if (k % 2 == 0) {
          sign = "+";
        }
        marks[loopR[k]][loopC[k]] = sign;

        if (k > 0) {
          pathText = pathText + " &rarr; ";
          formula = formula + " ";
        }
        pathText = pathText + "<span class='path-step'>" + cellName(loopR[k], loopC[k]) + " <span class='sign " + (sign == "+" ? "sign-plus" : "sign-minus") + "'>" + (sign == "+" ? "+" : "&minus;") + "</span></span>";
        formula = formula + (sign == "+" ? "+" : "&minus;") + cost[loopR[k]][loopC[k]];

        if (sign == "-") {
          if (minusText != "") {
            minusText = minusText + ", ";
          }
          minusText = minusText + a2[loopR[k]][loopC[k]];
        }
      }

      // ตารางก่อนโยก พร้อมเครื่องหมาย + / - (สร้างตอนนี้ ก่อนที่ a2, b2 จะถูกแก้)
      var tableBefore = buildResultTable(a2, b2, marks);

      // --- โยกของจริง: ตำแหน่งคู่ บวก theta, ตำแหน่งคี่ ลบ theta ---
      for (var k = 0; k < loopLen; k++) {
        if (k % 2 == 0) {
          a2[loopR[k]][loopC[k]] = a2[loopR[k]][loopC[k]] + theta;
        } else {
          a2[loopR[k]][loopC[k]] = a2[loopR[k]][loopC[k]] - theta;
        }
      }

      // ช่องว่างที่เพิ่งใส่ของ กลายเป็นช่องใช้งาน
      b2[bestI][bestJ] = true;

      // มีช่องที่ถูกลบจนเหลือ 0 -> เอาออกจากช่องใช้งาน "แค่ 1 ช่อง" (เพื่อให้จำนวนช่องใช้งานคงที่)
      var removed = false;
      var removedText = "";
      for (var k = 1; k < loopLen; k = k + 2) {
        if (a2[loopR[k]][loopC[k]] == 0 && removed == false) {
          b2[loopR[k]][loopC[k]] = false;
          removed = true;
          removedText = cellName(loopR[k], loopC[k]);
        }
      }

      round = round + 1;
      var totalAfter = calculateTotal(a2);

      // --- สร้าง HTML อธิบายรอบนี้ ---
      var r = "<div class='round-box'>";
      r = r + "<h4>รอบที่ " + round + "</h4>";

      r = r + "<div class='step-title'>1) ประเมินช่องว่างทุกช่อง (Evaluation Index)</div>";
      r = r + "<div class='info'>" + buildEvalList(evalI, evalJ, evalV, bestI, bestJ) + "</div>";

      r = r + "<div class='step-title'>2) เลือกช่องที่จะโยกของมาใส่</div>";
      if (mode == "min") {
        r = r + "<div class='info'>เลือก " + cellName(bestI, bestJ) + " เพราะดัชนี = " + bestIndex + " ติดลบมากที่สุด (ส่งผ่านเส้นทางนี้ถูกกว่าเดิมหน่วยละ " + Math.abs(bestIndex) + ")</div>";
      } else {
        r = r + "<div class='info'>เลือก " + cellName(bestI, bestJ) + " เพราะดัชนี = " + bestIndex + " เป็นบวกมากที่สุด (ส่งผ่านเส้นทางนี้ได้กำไรเพิ่มหน่วยละ " + Math.abs(bestIndex) + ")</div>";
      }

      r = r + "<div class='step-title'>3) เส้นทาง Closed Loop และเครื่องหมาย + / &minus;</div>";
      r = r + tableBefore;
      r = r + "<div class='path-list'>" + pathText + "</div>";
      r = r + "<div class='info'>ดัชนี = " + formula + " = " + bestIndex + "</div>";

      r = r + "<div class='step-title'>4) หาจำนวนที่โยก (&theta;)</div>";
      r = r + "<div class='info'>&theta; = ค่าน้อยที่สุดในช่องที่มีเครื่องหมาย &minus; = min(" + minusText + ") = <b>" + theta + "</b> หน่วย</div>";
      r = r + "<div class='info'>ช่องที่มี <span class='sign sign-plus'>+</span> เพิ่ม " + theta + " หน่วย, ช่องที่มี <span class='sign sign-minus'>&minus;</span> ลด " + theta + " หน่วย</div>";
      if (removed == true) {
        r = r + "<div class='info'>" + removedText + " เหลือ 0 จึงออกจากช่องใช้งาน และ " + cellName(bestI, bestJ) + " เข้ามาเป็นช่องใช้งานแทน</div>";
      }

      r = r + "<div class='step-title'>5) ผลหลังโยกสินค้า</div>";
      r = r + buildResultTable(a2, b2, null);
      r = r + "<div class='total-box total-small'>" + goodWord + "รวม: " + totalBefore + " &rarr; " + totalAfter + " (เปลี่ยน " + (totalAfter - totalBefore) + " = &theta; " + theta + " &times; ดัชนี " + bestIndex + ")</div>";
      r = r + "</div>";

      stepsHtml = stepsHtml + r;
    }
  }

  // แสดงผล
  var total = calculateTotal(a2);
  var html = "<h3>ขั้นตอนการปรับปรุงทีละรอบ (Stepping Stone)</h3>";
  html = html + "<div class='info'>เริ่มจากผล Northwest Corner = " + startTotal + "</div>";
  if (round == 0) {
    html = html + "<div class='info'>ผล Northwest Corner ดีที่สุดอยู่แล้ว ไม่ต้องปรับปรุง</div>";
  }
  html = html + stepsHtml;

  html = html + "<h3>ผลสุดท้ายจาก Stepping Stone</h3>";
  html = html + "<div class='info'>ปรับปรุงทั้งหมด " + round + " รอบ</div>";
  html = html + buildResultTable(a2, b2, null);
  if (mode == "min") {
    html = html + "<div class='total-box'>Total Minimum Cost = " + total + "</div>";
  } else {
    html = html + "<div class='total-box'>Total Maximum Profit = " + total + "</div>";
  }
  if (finished == false) {
    html = html + "<div class='info'>หยุดที่ 100 รอบ (อาจยังไม่ใช่ค่าที่ดีที่สุด)</div>";
  }
  document.getElementById("resultSS").innerHTML = html;
}


// ============================================================
//  ชื่อช่อง เช่น "Source 1 / Demand 3" (ใส่ Dummy กำกับถ้าเป็นแถว/คอลัมน์ Dummy)
// ============================================================
function cellName(i, j) {
  var s = "Source " + (i + 1);
  var d = "Demand " + (j + 1);
  if (i == dummyRow) {
    s = s + " (Dummy)";
  }
  if (j == dummyCol) {
    d = d + " (Dummy)";
  }
  return s + " / " + d;
}


// ============================================================
//  สร้างข้อความรายการดัชนีของช่องว่างทุกช่อง (ช่องที่ถูกเลือกจะไฮไลต์)
// ============================================================
function buildEvalList(evalI, evalJ, evalV, bestI, bestJ) {
  var text = "";
  for (var k = 0; k < evalI.length; k++) {
    var cls = "idx";
    if (evalI[k] == bestI && evalJ[k] == bestJ) {
      cls = "idx idx-best";
    }
    text = text + "<span class='" + cls + "'>S" + (evalI[k] + 1) + "-D" + (evalJ[k] + 1) + " = " + evalV[k] + "</span> ";
  }
  return text;
}


// ============================================================
//  หาเส้น Closed Loop (สี่เหลี่ยมหักมุมตรงๆ) ที่เริ่มจากช่องว่าง (startR, startC)
//  เดินสลับ แนวนอน -> แนวตั้ง -> แนวนอน ... โดยแวะได้เฉพาะ "ช่องใช้งาน" (b[][] เป็น true)
//  ใช้การลองเดินแล้วถอยกลับ (backtrack) ด้วย while ธรรมดา ไม่ใช้ recursion
//  คืนค่า จำนวนจุดในเส้น (ถ้าหาไม่เจอคืน 0) และเก็บจุดต่างๆ ไว้ใน loopR, loopC
// ============================================================
function findLoop(startR, startC, b) {
  var pathR = [startR];   // เก็บแถวของจุดที่เดินผ่านมา (จุดแรกคือช่องเริ่มต้น)
  var pathC = [startC];   // เก็บคอลัมน์ของจุดที่เดินผ่านมา
  var tryIdx = [0];       // จำว่าแต่ละระดับ ลองไปถึงตัวเลือกที่เท่าไรแล้ว
  var depth = 0;          // ระดับปัจจุบัน (อยู่ที่จุดที่เท่าไรของเส้น)

  while (depth >= 0) {
    // ถ้าอยู่ตำแหน่งคี่ (มาถึงด้วยการเดินแนวนอน), ไกลพอ (depth >= 3),
    // และอยู่คอลัมน์เดียวกับจุดเริ่ม -> ลากเส้นกลับจุดเริ่มต้นในแนวตั้งได้ = เส้นปิดสมบูรณ์
    if (depth % 2 == 1 && depth >= 3 && pathC[depth] == startC) {
      loopLen = depth + 1;
      for (var k = 0; k < loopLen; k++) {
        loopR[k] = pathR[k];
        loopC[k] = pathC[k];
      }
      return loopLen;
    }

    var foundNext = false;   // เจอจุดถัดไปที่เดินต่อได้หรือยัง

    // ระดับคู่ (0,2,4..) เดินแนวนอน = ไล่ดูทุกคอลัมน์ในแถวเดียวกัน
    // ระดับคี่ (1,3,5..) เดินแนวตั้ง = ไล่ดูทุกแถวในคอลัมน์เดียวกัน
    var limit = numR;
    if (depth % 2 == 0) {
      limit = numC;
    }

    var k = tryIdx[depth];   // เริ่มลองต่อจากตัวเลือกที่ค้างไว้
    while (k < limit && foundNext == false) {
      var nr;   // แถวของจุดที่กำลังลอง
      var nc;   // คอลัมน์ของจุดที่กำลังลอง
      if (depth % 2 == 0) {
        nr = pathR[depth];
        nc = k;
      } else {
        nr = k;
        nc = pathC[depth];
      }

      var ok = true;
      if (b[nr][nc] == false) {
        ok = false;            // ไม่ใช่ช่องใช้งาน -> แวะไม่ได้
      }
      for (var p = 0; p <= depth; p++) {
        if (pathR[p] == nr && pathC[p] == nc) {
          ok = false;          // เคยเดินผ่านจุดนี้แล้ว (รวมถึงจุดปัจจุบัน) -> ข้าม
        }
      }

      if (ok == true) {
        tryIdx[depth] = k + 1;   // จำไว้ว่าถ้าถอยกลับมา ให้ลองตัวถัดไป
        depth = depth + 1;       // เดินไปจุดใหม่
        pathR[depth] = nr;
        pathC[depth] = nc;
        tryIdx[depth] = 0;
        foundNext = true;
      } else {
        k = k + 1;               // ลองตัวเลือกถัดไป
      }
    }

    if (foundNext == false) {
      depth = depth - 1;         // ไม่มีทางไปต่อ -> ถอยกลับไปจุดก่อนหน้า
    }
  }

  return 0;   // ลองจนหมดแล้วไม่เจอเส้นปิด
}


// ============================================================
//  รวมต้นทุน/กำไรทั้งหมด = ผลรวมของ (จำนวนที่ส่ง x ค่าขนส่งต่อหน่วย) ทุกช่อง
// ============================================================
function calculateTotal(a) {
  var total = 0;
  for (var i = 0; i < numR; i++) {
    for (var j = 0; j < numC; j++) {
      total = total + a[i][j] * cost[i][j];
    }
  }
  return total;
}


// ============================================================
//  สร้างข้อความ HTML ของตารางสรุปการจัดสรรสินค้า
//  a = ตารางจำนวนที่ส่ง, b = ตารางช่องใช้งาน
//  marks = (ไม่บังคับ) ตารางเครื่องหมาย "+" / "-" ของช่องในเส้น Closed Loop ใส่ null ถ้าไม่ต้องการแสดง
// ============================================================
function buildResultTable(a, b, marks) {
  var html = "<div class='table-wrap'><table>";

  // --- แถวหัวตาราง (ใส่ (Dummy) กำกับที่คอลัมน์ Dummy) ---
  html = html + "<tr><th></th>";
  for (var j = 0; j < numC; j++) {
    if (j == dummyCol) {
      html = html + "<th>Demand " + (j + 1) + " <span class='dummy-label'>(Dummy)</span></th>";
    } else {
      html = html + "<th>Demand " + (j + 1) + "</th>";
    }
  }
  html = html + "<th>Supply</th></tr>";

  // --- แถวข้อมูล ---
  for (var i = 0; i < numR; i++) {
    if (i == dummyRow) {
      html = html + "<tr><th>Source " + (i + 1) + " <span class='dummy-label'>(Dummy)</span></th>";
    } else {
      html = html + "<tr><th>Source " + (i + 1) + "</th>";
    }

    for (var j = 0; j < numC; j++) {
      // เครื่องหมาย + / - (มีเฉพาะช่องที่อยู่ในเส้น Closed Loop)
      var signHtml = "";
      var markClass = "";
      if (marks != null && marks[i][j] == "+") {
        signHtml = " <span class='sign sign-plus'>+</span>";
        markClass = " cell-plus";
      } else if (marks != null && marks[i][j] == "-") {
        signHtml = " <span class='sign sign-minus'>&minus;</span>";
        markClass = " cell-minus";
      }

      if (b[i][j] == true) {
        // ช่องใช้งาน: ไฮไลต์เหลือง แสดงจำนวนที่ส่ง และค่าขนส่งตัวเล็กๆ
        html = html + "<td class='filled" + markClass + "'><div class='small'>" + cost[i][j] + "</div>" + a[i][j] + signHtml + "</td>";
      } else {
        html = html + "<td class='" + markClass + "'><div class='small'>" + cost[i][j] + "</div>-" + signHtml + "</td>";
      }
    }
    html = html + "<td>" + supply[i] + "</td></tr>";
  }

  // --- แถวล่างสุด (Demand) ---
  html = html + "<tr><th>Demand</th>";
  for (var j = 0; j < numC; j++) {
    html = html + "<td>" + demand[j] + "</td>";
  }
  html = html + "<td></td></tr>";

  html = html + "</table></div>";
  html = html + "<div class='info'>ตัวเลขเล็กในช่อง = ค่าขนส่ง/กำไรต่อหน่วย, ช่องสีเหลือง = จำนวนสินค้าที่จัดสรร</div>";
  if (marks != null) {
    html = html + "<div class='info'><span class='sign sign-plus'>+</span> = ช่องที่รับสินค้าเพิ่ม, <span class='sign sign-minus'>&minus;</span> = ช่องที่ถูกหักสินค้าออก</div>";
  }
  return html;
}
