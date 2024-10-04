import { Parser } from '@json2csv/plainjs';
import * as fs from 'fs';
import { XMLParser } from "fast-xml-parser";

const startYear = 2008;
const endYear = new Date().getFullYear() + 1;

// Filters.
let filters = [
    {
        field: 'date.created',
        value: {
            from: '2024-01-01T00:00:00+00:00',
            to: '2024-12-31T23:59:59+00:00'
        }
    }
];

/**
 * Get data from RW API.
 *
 * @param {int} offset
 * @param {int} limit
 */
async function getData(year) {
    // Base URL for the API.
    const url = new URL('https://oct.unocha.org/OCTws/OCHAOnline.asmx');

    const payload = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
        '    <soap:Body>',
        '    <GetDonorRankingForOCHAOnlineV2 xmlns="https://oct.unocha.org/OCTws/">',
        '        <year>' + year + '</year>',
        '        <MultiDonorFundsIds>330</MultiDonorFundsIds>',
        '        <UNandOtherAgenciesIds>330</UNandOtherAgenciesIds>',
        '        <PrivateDonationsIds>44</PrivateDonationsIds>',
        '        <ExcludeDonorIds>44</ExcludeDonorIds>',
        '        <ProjectGroupID>192</ProjectGroupID>',
        '    </GetDonorRankingForOCHAOnlineV2>',
        '    </soap:Body>',
        '</soap:Envelope>',
    ].join("\n");

    const xml = await fetch(url.toString(), {
        method: 'POST',
        body: payload,
        headers: {
            "Content-Type": "text/xml;charset=UTF-8",
            "SOAPAction": "https://oct.unocha.org/OCTws/GetDonorRankingForOCHAOnlineV2"
        }
    }).then(res => res.text())

    return xml;
}

/**
 * Build and write csv data.
 */
async function writeCsv(results, year, needsHeader) {
    // Define the output for each field.
    const opts = {
        fields: [
            {
                label: 'Year',
                value: (row) => year
            },
            {
                label: 'Rank',
                value: 'Rank'
            },
            {
                label: 'DonorName',
                value: 'DonorName'
            },
            {
                label: 'CountryCode',
                value: 'CountryCode'
            },
            {
                label: 'Earmarked',
                value: 'Earmarked'
            },
            {
                label: 'UnEarmarked',
                value: 'UnEarmarked'
            },
            {
                label: 'Total',
                value: 'Total'
            },

        ],
        header: needsHeader,
    };

    const json2csvParser = new Parser(opts);
    const csv = json2csvParser.parse(results);

    return csv;
}

(async function () {
    let combinedStream = fs.createWriteStream('./data.csv');    
    let needsHeader = true;

    const years = Array.from({length: (endYear - startYear)}, (v, k) => k + startYear);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: ""
    });

    for (const year of years) {
        console.info('Processing ' + year);
        let yearStream = fs.createWriteStream('./data_' + year + '.csv');    
        let XMLdata = await getData(year);
        
        let jObj = parser.parse(XMLdata);
        let data = jObj['soap:Envelope']['soap:Body'].GetDonorRankingForOCHAOnlineV2Response.GetDonorRankingForOCHAOnlineV2Result.Donors.DonorRankV2 || [];
    
        let csv = await writeCsv(data, year, needsHeader);
        combinedStream.write(csv);
        combinedStream.write("\n");

        csv = await writeCsv(data, year, true);
        yearStream.write(csv);
        yearStream.write("\n");
        yearStream.close();

        needsHeader = false;
    }

    combinedStream.close();
})();
