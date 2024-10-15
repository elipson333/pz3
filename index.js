const { chromium } = require("playwright");
const fs = require("fs");

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function scrapeTrainData(stationName, url) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    geolocation: { longitude: 21.0122, latitude: 52.2297 },
    permissions: ["geolocation"],
    locale: "pl-PL",
  });
  const page = await context.newPage();

  await page.setExtraHTTPHeaders({
    "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  });

  await page.goto(url, { waitUntil: "networkidle" });

  await page.evaluate(() => {
    window.scrollTo(0, Math.floor(Math.random() * document.body.scrollHeight));
  });

  await page.waitForSelector(".catalog-table__row", { timeout: 30000 });

  await page.waitForTimeout(randomDelay(2000, 5000));

  const data = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".catalog-table__row"));
    return rows.map((row) => {
      const departureElement = row.querySelector(".col-1 h3.item-value");
      const departure = departureElement
        ? departureElement.childNodes[4].textContent.trim()
        : "";
      const delay = departureElement
        ? departureElement.querySelector(".late")?.textContent.trim() ||
          "Brak opóźnienia"
        : "Brak opóźnienia";
      const platform =
        row.querySelector(".col-1 strong.item-value")?.textContent.trim() || "";
      const track =
        row
          .querySelectorAll(".col-1 strong.item-value")[1]
          ?.textContent.trim() || "";
      const carrier =
        row
          .querySelector('.col-2 strong.item-value[lang="pl-PL"]')
          ?.textContent.trim() || "";

      const rowText = row.textContent;
      const trainNumberMatch = rowText.match(/Nr pociągu\s*(\d+)/);
      const trainNumber = trainNumberMatch ? trainNumberMatch[1] : "";

      const relationElement = row.querySelector(
        ".col-2.col-12--phone strong.item-value"
      );
      let startStation = "";
      let endStation = "";
      if (relationElement) {
        const stationSpans =
          relationElement.querySelectorAll('span[lang="pl-PL"]');
        if (stationSpans.length >= 2) {
          startStation = stationSpans[0].textContent.trim();
          endStation = stationSpans[1].textContent.trim();
        } else if (stationSpans.length === 1) {
          startStation = stationSpans[0].textContent.trim();
        }
      }

      const difficulties =
        row.querySelector(".btn.btn--sm.color--alert")?.textContent.trim() ||
        "Brak utrudnień";

      return {
        departure,
        delay,
        platform,
        track,
        carrier,
        trainNumber,
        startStation,
        endStation,
        difficulties,
      };
    });
  });

  await browser.close();

  const timestamp = new Date().toISOString();
  const dataWithTimestamp = {
    timestamp: timestamp,
    stacja: stationName,
    data: data,
  };

  const fileName = `${stationName.replace(/\s+/g, "_")}_train_data.json`;
  const jsonData = JSON.stringify(dataWithTimestamp, null, 2);
  fs.writeFileSync(fileName, jsonData);

  console.log(
    `Dane dla stacji ${stationName} zostały zapisane do pliku ${fileName}`
  );
}

async function main() {
  const stationsData = JSON.parse(
    fs.readFileSync("stations_urls.json", "utf8")
  );

  for (const station of stationsData) {
    await scrapeTrainData(station.stacja, station.url);
    // Dodaj losowe opóźnienie między scrapingiem kolejnych stacji
    await new Promise((resolve) =>
      setTimeout(resolve, randomDelay(10000, 30000))
    );
  }
}

main().catch(console.error);
