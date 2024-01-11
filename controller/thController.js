const puppeteer = require('puppeteer');
exports.getPlansList = async (req, res) => {
  const url = req.body.url;
  const toPageNo = req.body.pageNo;

  const browser = await puppeteer.launch({
    // executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false, // Set to true for headless mode
    defaultViewport: false
  });

  const page = await browser.newPage();
  await page.goto(url);

  pageDetails = await getToPageNo(page, toPageNo);

  const {link, results} = await scrapePlanListingPage(page, true);

  res.send({
    link,
    plans: results,
    page: pageDetails
  });

}


exports.getPlanDetails = async (req, res) => {
  const paramsString = req.url.split('?')[1];
  const quotitUrl = `https://www.quotit.net/quotit/apps/Common/BenefitDetails.aspx?${paramsString}`;

  const browser = await puppeteer.launch({
    // executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false, // Set to true for headless mode
    defaultViewport: false
  });

  const planDetails = await scrapePlanDetailPage(browser, quotitUrl);
  res.send(planDetails);
}

exports.getCountyList = async (req, res) => {
  const zipcode = req.body.zipcode;
  const category = req.body.category; // Corrected typo

  try {
    const browser = await puppeteer.launch({
      headless: false, // Set to true for headless mode
      defaultViewport: false
    });

    const page = await browser.newPage();

    await page.goto('https://www.quotit.net/eproIFP/webPages/infoEntry/InfoEntryZip.asp?license_no=5B3WWR');

    const stateCountyList = await getCountyAndStates(page, zipcode);
    res.send({ stateCountyList });

    await browser.close();
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
};
exports.getData = async (req, res) => {
  console.log(req.body)
  const applicant = req.body.coveredMembers[0];
  const categorySelection = req.body.category;
  let productTypeSelection = req.body.productType;
  let coveredMembers = req.body.coveredMembers;

  let browser;
  try {

    const membersInHouse = 5;
    const householdIncome = 60000;

    browser = await puppeteer.launch({
      // executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: false,
      // defaultViewport: false
    });
    const page = await browser.newPage();

    await page.goto('https://www.quotit.net/eproIFP/webPages/infoEntry/InfoEntryZip.asp?license_no=5B3WWR', { timeout: 60000 });

    const stateCountyList = await getCountyAndStates(page, applicant.zipcode);

    const planTypes = await getPlanType(page);

    var planTypeSelection;
    if (categorySelection == "Individuals") {
      planTypeSelection = planTypes[0];
    } else if (categorySelection == "Medicare") {
      planTypeSelection = planTypes[2];
    } else {
      planTypeSelection = planTypes[1];
    }

    const countySelection = stateCountyList.countyOptions[0];

    await selectZipCodeCountyAndPlan(page, applicant, countySelection, planTypeSelection);

    const productTypes = categorySelection != "Medicare" ? await getProductTypes(page) : [];

    let productTypeSelectionElement;
    for (const productType of productTypes) {
      if (productType.label == productTypeSelection) {
        productTypeSelectionElement = productType;
        break;
      }
    }

    await setCoveredMembers(page, applicant, productTypeSelectionElement, coveredMembers, membersInHouse, householdIncome);

    const {link, results} = await scrapePlanListingPage(page, categorySelection == "Individuals");

    const pageDetails = await getToPageNo(page, 1);

    await browser.close();

    res.send({ link, plans: results, page: pageDetails });

  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
  finally {
    browser.close();
  }
}

async function selectZipCodeCountyAndPlan(page, applicant, countySelection, planTypeSelection) {

  await page.type('#zipCode', applicant.zipcode);

  const expectedResponseUrl = 'https://www.quotit.net/eproIFP/county.asp';
  await page.waitForResponse((response) => {
    return response.url().startsWith(expectedResponseUrl);
  });

  await page.waitForSelector('select[name="countyID"]');

  await new Promise((resolve) => setTimeout(resolve, 2000));

  try{
    await page.evaluate((countySelection) => {
      const select = document.querySelector('select[name="countyID"]');
      select.value = countySelection.value;
    }, countySelection);
  }catch (e){

  }

  await page.click(`input[name="covTypeID"][value="${planTypeSelection.value}"]`);

  // const buttonSelector = 'a[class="btn float-right"]';
  const buttonSelector = 'a.btn.float-right';
  await page.waitForSelector(buttonSelector);
  await page.click(buttonSelector);

  await page.waitForNavigation();
};


async function getPlanType(page) {
  //search for labels and with values
  let options = await page.evaluate(() => {
    const result = {};

    const tdElements = Array.from(document.querySelectorAll('td'));

    for (const tdElement of tdElements) {
      if (tdElement.textContent.trim().includes('Plan Type')) {
        const sibling = tdElement.nextElementSibling;

        const labelElements = Array.from(sibling.querySelectorAll('label'))
          .map(el => {
            return {
              label: el.textContent.replaceAll('\n', ' ').replace(/  +/g, ' ').trim(),
              value: el.querySelector('input').value
            }
          });
        return labelElements;
      }
    }
  });

  return options;
}

async function getProductTypes(page) {
  await page.waitForSelector('iframe');
  const iframeHandle = await page.$('iframe');
  const iframe = await iframeHandle.contentFrame();

  let productTypeOptions = await iframe.evaluate(() => {
    const result = {};

    const h2Elements = Array.from(document.querySelectorAll('h2'));

    for (const h2Element of h2Elements) {
      if (h2Element.textContent.trim().includes('Product Type')) {
        const parentElement = h2Element.parentElement;

        const labelElements = Array.from(parentElement.querySelectorAll('label:not([style])'))
          .map(el => {
            return {
              label: el.textContent.replaceAll('\n', ' ').replace(/  +/g, ' ').trim(),
              value: el.querySelector('input').value
            }
          });
        return labelElements;
      }
    }
  });
  return productTypeOptions;
}
async function getCountyAndStates(page, zipCode) {
  let cookie = '';
  (await page.cookies()).forEach((c) => {
    cookie += `${c.name}=${c.value};`;
  });

  const response = await fetch(`https://www.quotit.net/eproIFP/state.asp?zipCode=${zipCode}&countyID=-1`, {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "sec-ch-ua": "\"Google Chrome\";v=\"119\", \"Chromium\";v=\"119\", \"Not?A_Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest",
      "cookie": cookie,
      "Referer": "https://www.quotit.net/eproIFP/webPages/infoEntry/InfoEntryZip.asp?license_no=5B3WWR",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
  });

  const responseText = await response.text();
  console.log(responseText);
  const state = responseText.split('value=')[1].split('>')[0];
  console.log(state);
  const countyResponse = await fetch(`https://www.quotit.net/eproIFP/county.asp?zipCode=${zipCode}&countyID=-1&bInfoEntry=true`, {
    "headers": {
      "cookie": cookie,
    },
    "body": null,
    "method": "GET"
  });

  const countyResponseText = await countyResponse.text();
  let countyOptions = countyResponseText.split('\r\n').filter(l => l.startsWith('<option'));
  countyOptions = countyOptions.map(opt => {
    const value = opt.split('>')[0].split('value="')[1].split('"')[0];
    const name = opt.split('>')[1].split('<')[0];
    return {
      value, name
    }
  })
  console.log(countyOptions);

  return { state, countyOptions };
}

async function setCoveredMembers(page, applicant, productTypeSelectionElement, coveredMembers, membersInHouse, householdIncome) {
  await page.waitForSelector('iframe');

  const iframeHandle = await page.$('iframe');

  const iframe = await iframeHandle.contentFrame();

  if(productTypeSelectionElement){
    await iframe.click(`input[type="radio"][value="${productTypeSelectionElement.value}"]`);

    let dependentRows = 3;

    while (dependentRows < coveredMembers.length) {
      await iframe.click('[id="btn_add_a_dependents"]');
      dependentRows++;
    }
  }

  await iframe.evaluate((coveredMembers) => {
    const table = document.querySelector('#tb_Census_Information');
    const trs = Array.from(table.querySelectorAll('tr.table-01-color'));

    console.log('length: ', trs.length);
    // Loop through each row and fill in the data
    for (const [index, data] of coveredMembers.entries()) {
      const row = trs[index];
      // Skip the header row

      console.log(index);

      if (row) {
        const firstNameInput = row.querySelector(`input[class="input-firstName"]`);
        firstNameInput.value = data.firstName;

        const genderSelect = row.querySelector('select');
        genderSelect.value = data.gender;

        const dobInput = row.querySelector(`input[id="txtDoB-${index}"]`);
        dobInput.value = data.dob;

        const zipCodeInput = row.querySelector(`input[id="txtCensusZipCode-${index}"]`);
        zipCodeInput.value = data.zipcode;

        if(data.relationship){
          // const ulNoShowElement = row.querySelector(`ul[class="noshow"]`);
          // const li = row.querySelector(`ul[class="noshow"]`);
          const allRelationships = Array.from(row.querySelectorAll('li')).map(li => {
            return {
              text: li.innerText.trim(),
              value: li.getAttribute('data-val'),
            };
          });

          let val ;
          for (const r of allRelationships) {
            if(r.text == data.relationship){
              val = r.value;
              break;
            }
          }

          const dropdown = document.querySelector('div[id="relationshipTypeID_1"]');
          const inputRelationship = dropdown.querySelector('input[type="hidden"]');
          inputRelationship.value = val;
        }

        if (data.county) {
          const countySelect = row.querySelector(`select[name="ApplicantCountySelect"]`);
          countySelect.value = data.county.value;
        }

        if (data.tobaccoDate) {
          const zipCodeInput = row.querySelector(`input[name="txtTime"]`);
          zipCodeInput.value = data.tobaccoDate;
        }
      }
    }
  }, coveredMembers);

  if(productTypeSelectionElement){
    await iframe.evaluate((membersInHouse) => {
      const householdNumberSelect = document.querySelector('select[id="SelhouseholdSize"]');
      householdNumberSelect.value = membersInHouse;
    }, membersInHouse);

    await iframe.evaluate((householdIncome) => {
      const householdIncomeInput = document.querySelector('input[id="txtIncome"]');
      householdIncomeInput.value = householdIncome;
    }, householdIncome);
  }

  const buttonSelector = 'a.btn.float-right';
  await iframe.waitForSelector(buttonSelector);
  await iframe.click(buttonSelector);

}

async function getToPageNo(page, toPageNo){
  try {
    const pageIndicatorText = await page.$eval('.pageIndicator', (element) => element.textContent.trim());
    console.log(pageIndicatorText);

    splitString = pageIndicatorText.split(' ');
    currentPage = parseInt(splitString[1]);
    let totalPage = parseInt(splitString[3]);

    while (currentPage < toPageNo){
      await page.click('.next');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      currentPage++;
    }
    return {pageNo: currentPage, totalPage};

  }catch (e){
    console.log(e);
  }
}

async function scrapePlanListingPage(page, isIndividual) {
  try {
    const plansSelector = isIndividual ? 'div[class="plan-item"]' : 'div[class="plan-item scPlan-item"]';
    await page.waitForSelector(plansSelector);

    const link = await page.url();

    const results = await page.evaluate((isIndividual) => {
      const plansSelector = isIndividual ? 'div[class="plan-item"]' : 'div[class="plan-item scPlan-item"]';

      const results = [];
      const plans = document.querySelectorAll(plansSelector);

      console.log(plans.length);

      for (const plan of plans) {

        const planDetailsLink = 'https://turbohealth.us/getPlanDetails?'+plan.querySelector('[class="link"]')?.querySelector('a').getAttribute('href').split('?')[1];

        const planNameSelector = isIndividual ? 'div[class="plan-name"]' : 'div[class="scPlan-name"]' ;
        const planTierBadgeSelector = isIndividual ? 'div[class="plan-tier-badge"]' : 'div[class="scPlan-tier-badge"]' ;
        const planTypeBadgeSelector = isIndividual ? 'div[class="plan-type-badge"]' : 'div[class="scPlan-type-badge"]';
        const premiumSelector = isIndividual ? 'span[class="premium"]' : 'span[class="premium ahs-accent-coral"]';

        const planID = plan.querySelector('[class="p_planID"]')?.getAttribute('value');
        const planName = plan.querySelector(planNameSelector)?.textContent.trim();
        const planTierBadge = plan.querySelector(planTierBadgeSelector)?.textContent.trim();
        const planTypeBadge = plan.querySelector(planTypeBadgeSelector)?.textContent.trim();
        const premium = plan.querySelector(premiumSelector)?.textContent.trim();

        const scrappedPlan = { 'Plan ID': planID, 'Plan Name': planName, 'Link Details': planDetailsLink, 'Plan Tier Badge': planTierBadge, 'Plan Type Badge': planTypeBadge, 'Premium': premium };
        const descriptionElements = plan.querySelectorAll('span[class="label Benefit-description"]');
        descriptionElements.forEach(descriptionElement => {
          const description = descriptionElement?.textContent.trim();
          const valueElement = descriptionElement.nextElementSibling;
          const value = valueElement?.textContent.trim();
          scrappedPlan[description] = value;
        });
        results.push(scrappedPlan);
      }
      return results;
    }, isIndividual);
    return {link, results};
  } catch (e) {
    console.log(e);
  }
}

async function scrapePlanDetailPage(browser, link) {
  const page = await browser.newPage();
  await page.goto(link);

  const headerDetails = await page.evaluate( () => {
    details = {};

    tableElements = Array.from(document.querySelectorAll('.header-left table tbody tr'));
    details.title = tableElements[1].textContent.trim();
    details.imgUrl = 'https://www.quotit.net/'+document.querySelector('.header-left img').getAttribute('src');
    elements = Array.from(document.querySelectorAll('span[class="labeler"]'));
    elements.forEach((element) => {
      splitStrings = element.textContent.trim().split(':');
      details[splitStrings[0]] = splitStrings[1];
    })


    return details;
  });

  const benefitDetails = await page.evaluate(() => {
    const benefitTablesDiv = document.querySelector('div[id="benefit_tables"]');
    const tables = benefitTablesDiv.querySelectorAll('table');

    const data = {};

    tables.forEach((table) => {
      try {
        const tableDetails = {};
        const rows = Array.from(table.querySelectorAll('tr'));

        for (let i = 2; i < rows.length; i++) {
          const columns = rows[i].querySelectorAll('td');
          if (columns.length >= 3) {
            const serviceName = columns[0].textContent.trim();
            const tier1 = columns[1].textContent.trim();
            const network = columns[2].textContent.trim();
            let limits = columns[3].textContent.trim();
            if(limits == 'Plan Brochure'){
              limits = columns[3].querySelector('a').getAttribute('href');
            }
            tableDetails[serviceName] = {
              tier1,
              network,
              limits,
            };
          }
        }
        data[rows[0].textContent.trim()] = tableDetails;
      } catch (e) {
      }
    });
    return data;
  });
  page.close();
  return {headerDetails, benefitDetails};
}
