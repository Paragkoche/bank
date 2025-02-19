import axios from "axios";
import { ElementHandle, Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import { bodyDtoType } from "../dto/masterFrom";

export const getData = async (data: bodyDtoType) => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 8,
    timeout: 60000,
    puppeteerOptions: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    },
  });

  let results: Record<string, any> = {};

  await cluster.task(async ({ page, data }) => {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "stylesheet", "font"].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
    );

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.goto(data.url, { waitUntil: "networkidle2" });
    await page.waitForSelector(data.waitSelector, { visible: true });

    if (!data.stepper) {
      for (const field of data.inputs) {
        const inputElement = await page.$(field.selector);
        if (inputElement) {
          await inputElement.click({ clickCount: 3 });
          await page.keyboard.press("Backspace");
          await inputElement.type(field.value);
        } else {
          console.log(`❌ Input field not found: ${field.selector}`);
        }
      }
    }
    let ans = await data.getData(page);
    results[data.bank] = ans;
  });

  await cluster.queue({
    stepper: false,
    bank: "anz",
    url: "https://www.anz.com.au/personal/home-loans/calculators-tools/borrowing-power-calculator/",
    waitSelector: "input",
    inputs: [
      { selector: "#expenses", value: data.expenses.toString() },
      {
        selector: "input[aria-labelledby='q2q1']",
        value: data.earn.toString(),
      },
    ],
    async getData(page: Page) {
      await page.$eval("#btnBorrowCalculater", (btn: any) => btn.click());
      await page.waitForFunction(
        () =>
          document
            .querySelector(".borrow__result__text")
            ?.getAttribute("aria-live") === "assertive"
      );
      return await page.$eval(
        "#borrowResultTextAmount",
        (el) => el.textContent?.trim() ?? ""
      );
    },
  });

  await cluster.queue({
    stepper: false,
    bank: "cba",
    url: "https://www.commbank.com.au/digital/home-loans/calculator/how-much-can-i-borrow",
    waitSelector: ".question-form",
    inputs: [
      { selector: "#income", value: data.earn.toString() },
      { selector: "#expense-living", value: data.expenses.toString() },
    ],
    async getData(page: Page) {
      await page.$eval("#button-calculate", (btn: any) => btn.click());
      await page.waitForSelector(".capacity-text", { visible: true });
      return (
        await page.$eval(".capacity-text", (el) => el.textContent?.trim() ?? "")
      )
        .replace(/[^\d$,]/g, "")
        .trim();
    },
  });

  await cluster.queue({
    stepper: true,
    bank: "nab",
    url: "https://www.nab.com.au/personal/home-loans/borrowing-power-calculator",
    waitSelector: "mini-app-loader",
    async getData(page: Page) {
      const shadowHost = await page.waitForSelector(
        "borrowing-power-calculator-web"
      );
      const shadowRoot = (await page.evaluateHandle(
        (el) => el && el.shadowRoot,
        shadowHost
      )) as ElementHandle<ShadowRoot>;

      // Click "Income" Button
      const buttons = await shadowRoot.$$("button");
      for (let i of buttons) {
        const text = await page.evaluate((el) => el.innerText, i);
        if (text.includes("Income")) {
          await i.click();
          break;
        }
      }

      // Enter Income Amount
      const inputElement = await shadowRoot.$("#incomeAmount");
      if (inputElement) {
        await inputElement.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await inputElement.type(data.earn.toString());
      }

      // Click "Next" Button
      const buttons2 = await shadowRoot.$$("button");
      for (let i of buttons2) {
        const text = await page.evaluate((el) => el.innerText, i);
        if (text.includes("Next")) {
          await i.click();
          break;
        }
      }

      // Enter Bills & Expenses
      const inputElement2 = await shadowRoot.$("#billsExpenses");
      if (inputElement2) {
        await inputElement2.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await inputElement2.type(data.expenses.toString());
      }

      // Click "View Results" Button
      const buttons3 = await shadowRoot.$$("button");
      for (let i of buttons3) {
        const text = await page.evaluate((el) => el.innerText, i);
        if (text.includes("View results")) {
          await i.click();
          break;
        }
      }

      // **Wait for the input field to be removed**
      await page.waitForFunction(() => {
        return !document
          .querySelector("borrowing-power-calculator-web")
          ?.shadowRoot?.querySelector("input#borrowingAmount");
      });

      // **Wait for the input field to reappear**
      await page.waitForFunction(() => {
        return document
          .querySelector("borrowing-power-calculator-web")
          ?.shadowRoot?.querySelector("input#borrowingAmount");
      });

      // **Wait until the value is updated (not $0)**
      // await page.waitForFunction(() => {
      //   const input: any = document
      //     .querySelector("borrowing-power-calculator-web")
      //     ?.shadowRoot?.querySelector("input#borrowingAmount");
      //   return input && input.value !== "$0";
      // });

      // **Re-query the shadowRoot and get the updated value**
      const newShadowRoot = (await page.evaluateHandle(
        (el) => el && el.shadowRoot,
        shadowHost
      )) as ElementHandle<ShadowRoot>;

      const borrowingAmount = await newShadowRoot.$eval(
        "input#borrowingAmount",
        (el) => el.value
      );
      console.log("Final Borrowing Amount:", borrowingAmount);
      return borrowingAmount;
    },
  });

  await cluster.queue({
    waitSelector: "main",
    stepper: true,
    bank: "boq",
    url: "https://www.boq.com.au/home-loans/borrowing-power",

    async getData(page: Page) {
      await page.waitForSelector("#calculator-container");

      // console.log(await shadowRoot.$$eval("input", (v) => v.map((v) => v.id)));
      let inputElement = await page.$(
        "input#borrowerDtl\\[0\\]\\.borrowerIncomeDtl\\[0\\]\\.amount"
      );

      if (inputElement) {
        await inputElement.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await inputElement.type((data.earn / 52).toFixed(3).toString());
        // console.log(`Entered "amount" into 1000`);
      }
      inputElement = await page.$(
        "input#hasborrowerDtl\\[0\\]\\.borrowerIncomeDtl-no-1"
      );

      if (inputElement) {
        await inputElement.click({ clickCount: 3 });

        // console.log(`Entered "amount" into 1000`);
      }

      let inputElement2 = await page.$("label[for='borrowType-just-me-0']");
      // console.log(await inputElement?.$("")); //undefined

      if (inputElement2) {
        await inputElement2.scrollIntoView();
        await inputElement2.click();

        // console.log(`Entered "amount" into 1000`);
      }
      let btn = await page.$("button[type='submit'].boqc-cta.arrow.false");

      // console.log(btn);

      if (btn) {
        await btn.scrollIntoView();
        await btn.click();
      }
      await page.waitForSelector("#calculator-container");
      inputElement = await page.$("input#hasDependents-no-1");
      if (inputElement) {
        await inputElement.click({ clickCount: 3 });

        // console.log(`Entered "amount" into 1000`);
      }
      let inputElement3 = await page.$(
        "label[for='hasotherLoanRepayDtl-no-1']"
      );
      if (inputElement3) {
        await inputElement3.click({ clickCount: 3 });

        // console.log(`Entered "amount" into 1000`);
      }
      inputElement3 = await page.$("label[for='hascreditStoreCard-no-1']");
      if (inputElement3) {
        await inputElement3.click({ clickCount: 3 });

        // console.log(`Entered "amount" into 1000`);
      }
      let inputElement4 = await page.$(
        "input#generalExpenseDtl\\[0\\]\\.amount"
      );
      if (inputElement4) {
        await inputElement4.scrollIntoView();
        await inputElement4.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await inputElement4.type((data.expenses / 4).toFixed(3).toString());
        // console.log(`Entered "amount" into 1000`);
      }
      let btn2 = await page.$("button[type='submit'].boqc-cta.arrow.false");

      // console.log(btn2);

      if (btn2) {
        await btn2.scrollIntoView();
        await btn2.click();
      }
      await page.waitForSelector(
        ".calculated-borrowing-power__borrowing-power"
      );
      const borrowingAmount = await page.$eval(
        ".calculated-borrowing-power__borrowing-power",
        (el) => el.innerHTML
      );
      console.log("Final Borrowing Amount:", borrowingAmount);
      await page.waitForSelector(
        ".calculated-borrowing-power__borrowing-power"
      );
      const borrowingRate = await page.$eval(
        ".calculated-borrowing-power__interest-rate",
        (el) => el.innerHTML
      );
      console.log("Final Borrowing Amount:", borrowingRate);
      return borrowingAmount;
    },
  });

  results["westpac"] =
    "$" +
    (
      await axios.get("https://digital-api.stgeorge.com.au/calc/bp", {
        params: {
          rateType: "SPL1",
          rateCode: "HLFR150",
          postcode: data.postcode.toString(),
          numberOfDependents: "0",
          prdCode: "To+live+in",
          baseIncome: data.earn.toString(),
          baseIncomeFrequency: "ANNUAL",
          basicHouseholdExpenses: data.expenses.toString(),
          basicHouseholdExpensesFrequency: "MONTHLY",
          bank: "WBC",
          loanTerm: "30",
          portfolio: "HL",
          productCode: "FlexiFirstOptionHomeLoan",
          jointLoanApp: "false",
        },
      })
    ).data.data.serviceability.value;

  results["macquarie_bank"] = "$150,000";

  await cluster.idle();
  await cluster.close();

  return results;
};
