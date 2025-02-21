import axios from "axios";
import { ElementHandle, Page } from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import { bodyDtoType } from "../dto/masterFrom";

const formatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});
function convertCurrencyToNumber(currency: string) {
  return Number(currency.replace(/[^0-9.-]+/g, ""));
}

const apiCall = async (data: bodyDtoType) => {
  return await axios.get("https://digital-api.stgeorge.com.au/calc/bp", {
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
  });
};

const apiCall2 = async (data: bodyDtoType) => {
  let json = JSON.stringify({
    Applicants: [
      {
        BaseIncome: {
          Amount: data.earn,
          Frequency: "ANNUALLY",
        },
        BonusOvertimeCommIncome: null,
        RentalIncome: null,
        OtherIncome: null,
        Primary: true,
      },
    ],
    Expense: {
      Living: {
        Amount: data.expenses,
        Frequency: "MONTHLY",
      },
      Rental: null,
    },
    NumOfDependants: 0,
    PropertyType: "OWNER_OCCUPIED",
    PostSettlementPostcode: data.postcode.toString(),
    LoanAmount: 0,
    PropertyValue: data.earn,
  });

  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://www.ing.com.au/api/BorrowPowerCalc/Service/BorrowPowerCalcService.svc/json/BorrowPowerCalc/BorrowPowerCalc",
    headers: {
      "Content-Type": "application/json",
    },
    data: json,
  };
  return await axios.request(config);
};
export const getData = async (data: bodyDtoType) => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 16,
    puppeteerOptions: {
      executablePath:
        "/home/azureuser/.cache/puppeteer/chrome/linux-133.0.6943.98/chrome-linux64/chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    },
  });

  let results: Record<string, any> = {};

  await cluster.task(async ({ page, data }) => {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "font"].includes(req.resourceType())) {
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
      let amount = await page.$eval(
        "#borrowResultTextAmount",
        (el) => el.textContent?.trim() ?? ""
      );
      // console.log("Final Borrowing Amount (anz):", amount);

      return {
        value: formatter.format(convertCurrencyToNumber(amount)),
        rate: "2 year fix rate 5.74% p.a. (6.94% p.a. Comparison rate) ",
      };
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
      return {
        value: formatter.format(
          convertCurrencyToNumber(
            (
              await page.$eval(
                ".capacity-text",
                (el) => el.textContent?.trim() ?? ""
              )
            )
              .replace(/[^\d$,]/g, "")
              .trim()
          )
        ),
        rate: await page.$eval(
          "#loan-product-helptext",
          (el) => el.textContent?.trim() ?? ""
        ),
      };
    },
  });

  await cluster.queue({
    stepper: true,
    bank: "nab",
    url: "https://www.nab.com.au/personal/home-loans/calculators/borrowing-calculator",
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
      let s = await newShadowRoot.$eval(
        "div[data-testid='comparison-rate'] dd",
        (el) => el.textContent
      );
      let ds = await newShadowRoot.$eval(
        "div[data-testid='interest-rate'] dd",
        (el) => el.textContent
      );
      const rate = `Principal & interest rate ${ds!} and comparison rate ${s!}`;
      // console.log("Final Borrowing Amount:", borrowingAmount);
      return {
        value: formatter.format(convertCurrencyToNumber(borrowingAmount)),
        rate: rate,
      };
    },
  });

  await cluster.queue({
    waitSelector: "main",
    stepper: true,
    bank: "boq",
    url: "https://www.boq.com.au/personal/tools-and-calculators/borrowing-power-calculator",

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
      // console.log("Final Borrowing Amount:", borrowingAmount);
      await page.waitForSelector(
        ".calculated-borrowing-power__borrowing-power"
      );
      const borrowingRate = await page.$eval(
        ".calculated-borrowing-power__info",
        (el) => el.textContent
      );
      // console.log("Final Borrowing Amount:", borrowingRate);
      return {
        value: formatter.format(convertCurrencyToNumber(borrowingAmount)),
        rate: borrowingRate,
      };
    },
  });

  let apiD = await apiCall(data);

  results["westpac"] = {
    value: formatter.format(apiD.data.data.serviceability.value),
    rate:
      "Assessment Rate " +
      apiD.data.data.serviceability.assessmentRate +
      "% p.a",
  };
  apiD = await apiCall2(data);
  results["ing"] = {
    value: apiD.data.Result
      ? formatter.format(apiD.data.Response.BorrowAmount)
      : "Not estimate available",
    rate: apiD.data.Result
      ? "CompInterest Rate " +
        apiD.data.Response.Repayment.CompInterestRate +
        "% p.a Interest Rate " +
        apiD.data.Response.Repayment.InterestRate +
        "% p.a"
      : "Not estimate available",
  };

  cluster.queue({
    url: "https://online.macquarie.com.au/originations/borrowing-power/calculate",
    waitSelector: "app-calculate-form-details",
    bank: "macquarie",
    stepper: true,
    async getData(page: Page) {
      // console.log(
      //   "====================================================BOQ====================================================================="
      // );

      await page.waitForSelector("app-calculate-form-details");

      const parentLabel = await page.$eval("mq-tile-selector input", (p) => {
        return p.name;
      });

      let input = await page.$(`input[name='${parentLabel}']`);
      if (input) {
        input.scrollIntoView();
        input.click();
      }

      const parentLabel2 = await page.$eval(
        'mq-tile-selector[data-testid="borrowerType"] input',
        (p) => {
          // Find the closest parent label
          return p.name;
        }
      );
      let input2 = await page.$(`input[name='${parentLabel2}']`);
      if (input2) {
        input2.scrollIntoView();
        input2.click();
      }
      await page.waitForSelector(
        'mq-numeric-input[data-testid="numberOfDependents"]'
      );
      const inputElement = await page.$eval(
        'mq-numeric-input[data-testid="numberOfDependents"] input',
        (label) => {
          return label.id;
        }
      );
      // Enter Income Amount
      const inputElementI = await page.$(`#${inputElement}`);
      if (inputElementI) {
        await inputElementI.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await inputElementI.type("0");
      }
      await page.waitForSelector(
        'mq-button-group[data-testid="repaymentType"]',
        { visible: true }
      );
      const payment = await page.$(
        'mq-button-group[data-testid="repaymentType"] button'
      );
      if (payment) {
        await payment.scrollIntoView();
        await payment.click();
      }
      await page.waitForSelector(
        "mq-numeric-input[data-testid='Base income before tax']"
      );
      const inputElementE = await page.$(
        `mq-numeric-input[data-testid='Base income before tax'] input`
      );
      if (inputElementE) {
        await inputElementE.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await inputElementE.type(data.earn.toString());
      }
      await page.waitForSelector(
        "mq-numeric-input[data-testid='Total living expenses']"
      );
      const inputElementX = await page.$(
        `mq-numeric-input[data-testid='Total living expenses'] input`
      );
      if (inputElementX) {
        await inputElementX.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await inputElementX.type(data.expenses.toString());
      }
      const btn = await page.$(`.borrowing__one-button-footer button`);
      if (btn) {
        await btn.scrollIntoView();
        await btn.click();
      }
      await page.waitForNavigation({ waitUntil: "networkidle2" });

      await page.evaluate(() => {
        const appRevealHeader = document.querySelector("app-reveal-header");
        if (appRevealHeader && appRevealHeader.shadowRoot) {
          const amountElement = appRevealHeader.shadowRoot.querySelector(
            ".reveal-header__amount.ng-star-inserted"
          );
          if (amountElement) {
            amountElement.scrollIntoView();
          }
        }
      });
      let value = formatter.format(
        convertCurrencyToNumber(
          await page.$eval(
            ".reveal-header__amount.ng-star-inserted",
            (el) => el.textContent?.replace(/[^\d$,]/g, "").trim() ?? ""
          )
        )
      );

      await page.waitForSelector(
        "app-loan-breakdown .loan-breakdown__repayments-amount-description"
      );
      await page.evaluate(() => {
        const appRevealHeader = document.querySelector("app-loan-breakdown");

        if (appRevealHeader && appRevealHeader.shadowRoot) {
          const amountElement = appRevealHeader.shadowRoot.querySelector(
            ".loan-breakdown__repayments-amount-description"
          );

          if (amountElement) {
            amountElement.scrollIntoView();
          }
        }
      });
      let rate = await page.$eval(
        ".loan-breakdown__repayments-amount-description",
        (el) => el.textContent ?? ""
      );

      return { value, rate };
    },
  });
  await cluster.queue({
    url: "https://d199to9k0kd0mu.cloudfront.net/borrowing-power-v2/wiwo-borrowing-power/clients/amp/index.html?frameId=wiwo-tzububi&hostUrl=https%3A%2F%2Fwww.amp.com.au%2Fhome-loans%2Fcalculators%2Fborrowing-power-calculator&configUrl=%2Fborrowing-power-v2%2Fconfig%2Fwiwo-borrowing-power-config.json#!/start",
    waitSelector: "bp-route-main-view[rpy-view-model='repaymentViewModel']",
    stepper: true,
    bank: "amp",
    async getData(page: Page) {
      await page.waitForSelector("div[ui-view='app-content']");
      let single = await page.$("input[ng-value='wiwoRadioItem']");
      if (single) {
        await single.scrollIntoView();
        await single.click();
        // console.log("Single Clicked");
      }
      await page.waitForSelector("select[ng-model='$ctrl.modelField']", {
        visible: true,
      });

      await page.select("select[ng-model='$ctrl.modelField']", "object:58");
      // console.log("Selected 58");
      let income = await page.$(
        ".currency-slider__result.wiwo-slider__input.ww-input-group input[ng-model='$ctrl.modelField']"
      );
      if (income) {
        await income.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await income.type("50000");
        // console.log("Entered Income");
      }
      let tabExp = await page.$(".uib-tab--expenses");
      if (tabExp) {
        await tabExp.click();
        // console.log("Clicked Expenses");
      }
      await page.waitForSelector(
        "items-single[expense-model='$ctrl.livingExpenseModel']"
      );
      let expenses = await page.$(
        "items-single[expense-model='$ctrl.livingExpenseModel'] input"
      );
      if (expenses) {
        await expenses.click({ clickCount: 3 });
        await page.keyboard.press("Backspace");
        await expenses.type("500");
        // console.log("Entered Expenses");
      }
      let tabResalt = await page.$(".uib-tab--results");
      if (tabResalt) {
        await tabResalt.click();
        // console.log("Clicked Results");
      }
      const borrowingAmount =
        (await page.$eval(".bp-result--primary", (el) => el.textContent)) ?? "";

      const rate = await page.$eval(".result-line--rate0", (el) =>
        el.textContent?.trim().replace(/\s+/g, " ")
      );

      const rate2 = await page.$eval(".result-line--comparison-rate", (el) =>
        el.textContent?.trim().replace(/\s+/g, " ")
      );
      return {
        value: formatter.format(convertCurrencyToNumber(borrowingAmount)),
        rate: `Principal & interest rate ${rate} and comparison rate ${rate2}`,
      };
    },
  });

  await cluster.idle();
  await cluster.close();

  return results;
};
