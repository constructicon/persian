// with this we make js less forgiving so that we catch
// more hidden errors during development
'use strict';

// https://stackoverflow.com/a/196991
function to_title_case(str) {
    return str.replace(
        /\w\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}


function reverse(s) {
    return s.split("").reverse().join("");
}


function build_search_index(record_numbers, records, keys) {
    // Initialize FlexSearch index using FlexSearch.create()

    var index = new FlexSearch.Document({
        // encode: 'balance',    // Balanced encoding for efficient search
        tokenize: 'reverse',  // Tokenize based on reverse (good for RTL text)
        rtl: true,            // Enables Right-to-Left text handling
        doc: {
            id: 'record',     // Each document is identified by its record number
            // field: keys       // Define which fields to index (these will come from records)
            field: keys
        }
    });

    // Add records to the index
    for (let record_number of record_numbers) {
        const record = records[record_number];
        if (record) {
            // Construct the document with fields for each record
            // let dict_out = {};
            let dict_out = {record: Number(record_number)}; // Ensure the unique ID is included
            for (let k of keys) {
                dict_out[k] = record[k] || ''; // Add the value of the field (empty string if not found)
            }
            // Add the document to the index
            // console.log(dict_out)
            // console.log(record_number, dict_out)
            index.add(Number(record_number), dict_out);
        }
    }

    // console.log(index.search([{ query: 'ربطی', field: 'name' }]))
    return index;        // Return the search index
}



function collect_options(record_numbers, records, key, is_list) {
    let s = new Set();
    for (let record_number of record_numbers) {
        if (is_list) {
            for (let element of records[record_number][key]) {
                if (element != null) {
                    s.add(element);
                }
            }
        } else {
            let element = records[record_number][key];
            if (element != null) {
                s.add(element);
            }
        }
    }

    let items = Array.from(s);
    items.sort();

    let tree = [];
    for (let element of items) {
        tree.push({
            id: element,
            label: element
        });
    }

    return tree;
}


function object_is_empty(obj) {
    for (let key in obj) {
        if (obj.hasOwnProperty(key))
            return false;
    }
    return true;
}


// translates array to list of items
function _helper(array) {
    let tree = [];

    let keys = [];
    for (let prop in array) {
        keys.push(prop);
    }
    keys.sort();

    for (let prop of keys) {
        if (Object.prototype.hasOwnProperty.call(array, prop)) {
            if (object_is_empty(prop)) {
                tree.push({
                    id: prop,
                    label: prop,
                });
            } else {
                tree.push({
                    id: prop,
                    label: prop,
                    children: _helper(array[prop]),
                });
            }
        }
    }

    return tree;
}



function collect_options_tree(record_numbers, records, key) {
    // first we build up a simpler array tree from all entries
    let tree_array = {};
    for (let record_number of record_numbers) {
        if (records[record_number][key] != null) {
            for (let element_0 of records[record_number][key]) {
                let type_0 = element_0["type"];
                if (!(type_0 in tree_array)) {
                    tree_array[type_0] = {};
                }
                if ("subtypes" in element_0) {
                    for (let element_1 of element_0["subtypes"]) {
                        let type_1 = element_1["type"];
                        if (!(type_1 in tree_array[type_0])) {
                            tree_array[type_0][type_1] = {};
                        }
                        if ("subtypes" in element_1) {
                            for (let element_2 of element_1["subtypes"]) {
                                let type_2 = element_2["type"];
                                if (!(type_2 in tree_array[type_0][type_1])) {
                                    tree_array[type_0][type_1][type_2] = {};
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // in the second step we translate this to a structure required by https://vue-treeselect.js.org/
    let tree = _helper(tree_array);

    return tree;
}


function flatten_semantic_types(record_numbers, records) {
    let key = "semantic_types";

    // FIXME: this traversal is similar to function above
    for (let record_number of record_numbers) {
        let flattened_list = [];
        if (records[record_number][key] != null) {
            for (let element_0 of records[record_number][key]) {
                let type_0 = element_0["type"];
                flattened_list.push(type_0);
                if ("subtypes" in element_0) {
                    for (let element_1 of element_0["subtypes"]) {
                        let type_1 = element_1["type"];
                        flattened_list.push(type_1);
                        if ("subtypes" in element_1) {
                            for (let element_2 of element_1["subtypes"]) {
                                let type_2 = element_2["type"];
                                flattened_list.push(type_2);
                            }
                        }
                    }
                }
            }
        }
        records[record_number]["semantic_types_flat"] = flattened_list;
    }

    return records;
}


async function fetch_data(data, url_prefix) {
    // let r = await axios.get(url_prefix + 'data-combined-debug.yml');
    let r = await axios.get(url_prefix + 'data-combined.yml');
    let json_data = jsyaml.load(r.data);

    let records = {};
    let record_numbers = [];
    let levels = new Set();

    for (let key of Object.keys(json_data)) {
        records[key] = json_data[key];
        records[key].record = key;
        record_numbers.push(key);
        levels.add(json_data[key].cefr_level);
    }

    data.records = records;
    data.record_numbers = record_numbers;

    data.levels = Array.from(levels);
    data.levels.sort();

    data.semantic_roles_options = collect_options(data.record_numbers, data.records, 'semantic_roles', true);
    data.morphology_options = collect_options(data.record_numbers, data.records, 'morphology', true);
    data.syntactic_type_of_construction_options = collect_options(data.record_numbers, data.records, 'syntactic_type_of_construction', true);
    data.syntactic_function_of_anchor_options = collect_options(data.record_numbers, data.records, 'syntactic_function_of_anchor', true);
    data.syntactic_structure_of_anchor_options = collect_options(data.record_numbers, data.records, 'syntactic_structure_of_anchor', true);
    data.part_of_speech_of_anchor_options = collect_options(data.record_numbers, data.records, 'part_of_speech_of_anchor', true);
    data.level_options = collect_options(data.record_numbers, data.records, 'cefr_level', false);

    data.semantic_types_options = collect_options_tree(data.record_numbers, data.records, 'semantic_types');

    // we need to flatten the semantic types tree for the search index
    // for some reason it does not pick up the options otherwise
    data.records = flatten_semantic_types(data.record_numbers, data.records);

    data.search_index = {};
    // for (let key of ['name',
    //         'name_transcription',
    //         'illustration',
    //         'illustration_transcription',
    //         'semantic_roles',
    //         'morphology',
    //         'syntactic_type_of_construction',
    //         'syntactic_function_of_anchor',
    //         'syntactic_structure_of_anchor',
    //         'part_of_speech_of_anchor',
    //         'cefr_level',
    //         'semantic_types_flat',
    //     ]) {
    //     data.search_index[key] = build_search_index(data.record_numbers, data.records, [key]);    
        // console.log(data.search_index['name'])
    // }
    const keys_ = ['name',
                'name_transcription',
                'illustration',
                'illustration_transcription',
                'semantic_roles',
                'morphology',
                'syntactic_type_of_construction',
                'syntactic_function_of_anchor',
                'syntactic_structure_of_anchor',
                'part_of_speech_of_anchor',
                'cefr_level',
                'semantic_types_flat',
            ]
    data.search_index = build_search_index(data.record_numbers, data.records, keys_);
    data.all_data_loaded = true;
    data.show_data_spinner = false;
}


// based on https://stackoverflow.com/a/19270021 (CC-BY-SA 3.0)
function random_selection(arr, n_max) {
    let len = arr.length;
    let n = Math.min(n_max, len);
    let result = new Array(n);
    let taken = new Array(len);
    while (n--) {
        let x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}


Vue.component('treeselect', VueTreeselect.Treeselect);


var app = new Vue({
    el: '#app',
    delimiters: ['{[', ']}'],
    data: {
        search_index: null,
        show_additional_information: false,
        show_data_spinner: true,
        all_data_loaded: false,
        current_record_number: null,
        record_numbers: [],
        record_numbers_matching_search: [],
        records: {},
        daily_dose_level: 'A1',
        search_string: '',
        levels: [],
        semantic_roles_options: [],
        semantic_roles_selected: null,
        morphology_options: [],
        morphology_selected: null,
        syntactic_type_of_construction_options: [],
        syntactic_type_of_construction_selected: null,
        syntactic_function_of_anchor_options: [],
        syntactic_function_of_anchor_selected: null,
        syntactic_structure_of_anchor_options: [],
        syntactic_structure_of_anchor_selected: null,
        part_of_speech_of_anchor_options: [],
        part_of_speech_of_anchor_selected: null,
        level_options: [],
        level_selected: null,
        semantic_types_options: [],
        semantic_types_selected: null,
    },
    created: function() {
        this.show_data_spinner = true;
        fetch_data(this, 'https://raw.githubusercontent.com/constructicon/persian-data/generated/');

        // https://lodash.com/docs#debounce
        this.search_debounced = _.debounce(this.search, 500);
        this.advanced_search_debounced = _.debounce(this.advanced_search, 500);
    },
    watch: {
        all_data_loaded: function(new_, old_) {
            // to make sure that when we load the page first time, we see all results
            this.search();
        },
        search_string: function(new_, old_) {
            this.search_debounced();
        },
        semantic_roles_selected: function(new_, old_) {
            this.advanced_search_debounced();
        },
        morphology_selected: function(new_, old_) {
            this.advanced_search_debounced();
        },
        syntactic_type_of_construction_selected: function(new_, old_) {
            this.advanced_search_debounced();
        },
        syntactic_function_of_anchor_selected: function(new_, old_) {
            this.advanced_search_debounced();
        },
        syntactic_structure_of_anchor_selected: function(new_, old_) {
            this.advanced_search_debounced();
        },
        part_of_speech_of_anchor_selected: function(new_, old_) {
            this.advanced_search_debounced();
        },
        level_selected: function(new_, old_) {
            this.advanced_search_debounced();
        },
        semantic_types_selected: function(new_, old_) {
            this.advanced_search_debounced();
        },
    },
    methods: {
        // for x={'this': 'that'} returns 'this'
        key: function(x) {
            return Object.keys(x)[0];
        },
        // for x={'this': 'that'} returns 'that'
        value: function(x) {
            return x[Object.keys(x)[0]];
        },
        search: function() {
            const normalized_search = this.search_string.normalize('NFC').trim();

            if (!this.search_string) {
                // Return all records if the search string is empty
                this.record_numbers_matching_search = this.record_numbers;
            }
            else {
                const fields_to_search = ['name', 'name_transcription', 'illustration', 'illustration_transcription'];
                const search_results = this.search_index.search(normalized_search, fields_to_search);

                // Extract `result` arrays from the search results
                let record_numbers_matching_search = [];
                search_results.forEach(resultObj => {
                    if (resultObj.result) {
                        record_numbers_matching_search.push(...resultObj.result);
                    }
                });
    
                // Remove duplicates and sort the results
                record_numbers_matching_search = [...new Set(record_numbers_matching_search)];
                record_numbers_matching_search.sort((a, b) => a - b);
        
                this.record_numbers_matching_search = record_numbers_matching_search;
            }
        

        },
        
        advanced_search: function() {
            let selected_options = {};
            selected_options['semantic_roles'] = this.semantic_roles_selected;
            selected_options['morphology'] = this.morphology_selected;
            selected_options['syntactic_type_of_construction'] = this.syntactic_type_of_construction_selected;
            selected_options['syntactic_function_of_anchor'] = this.syntactic_function_of_anchor_selected;
            selected_options['syntactic_structure_of_anchor'] = this.syntactic_structure_of_anchor_selected;
            selected_options['part_of_speech_of_anchor'] = this.part_of_speech_of_anchor_selected;
            selected_options['cefr_level'] = this.level_selected;
            selected_options['semantic_types_flat'] = this.semantic_types_selected;

            let index = this.search_index

            // Check if no options are selected
            const hasSelectedOptions = Object.values(selected_options).some(option => option && option.length > 0);
                
            if (!hasSelectedOptions) {
                // If no options are selected, return all records
                this.record_numbers_matching_search = this.record_numbers;
                return;
            }

            let record_numbers_matching_search = new Set();

            for (let key in selected_options) {
                if (selected_options[key]) {
                    // Search each field separately
                    const search_string = '"' + selected_options[key].join('" "') + '"';
                    const results = index.search(search_string, { field: key, enrich: true });
        
                    // Add results to the matching records set
                    for (let result of results) {
                        for (let doc of result.result) {
                            record_numbers_matching_search.add(doc);
                        }
                    }
                }
            }
        
            // Convert to sorted array
            record_numbers_matching_search = [...new Set(record_numbers_matching_search)];
            record_numbers_matching_search.sort((a, b) => a - b);
            this.record_numbers_matching_search = record_numbers_matching_search;
        },
        
        annotate: function(text, reverse_string) {
            // renders words that come right after [...] as subscript with color

            if (reverse_string) {
                let matches = text.match(/(?<=\])[A-Za-z]+/g);
                if (matches != null) {
                    for (let substring of matches){
                        text = text.replace(substring, '<sub><span style="color: #db2f6d">' + reverse(substring) + '</span></sub>');
                    }
                }
            } else {
                const matches = [...text.matchAll(/(?<=\])[A-Za-z]+/g)];

                if (matches.length > 0) {
                    // Iterate over matches in reverse to avoid index shifting issues
                    for (let i = matches.length - 1; i >= 0; i--) {
                        const match = matches[i];
                        const substring = match[0];
                        const startIndex = match.index;
                
                        // Replace the specific match only at its position
                        text = text.substring(0, startIndex) +
                               '<sub><span style="color: #db2f6d">' + substring + '</span></sub>' +
                               text.substring(startIndex + substring.length);
                    }
                }

            }
            return text;

        },

        remove_quotation_marks(text) {
            // removes the 1 character and two last characters, bad practive but works with
            // strings returned by the value() function
            const new_string = text.slice(1, -2)
            return new_string;

        },
        get_random_selection: function() {
            let records_with_this_level = [];
            for (let record_number of this.record_numbers) {
                if (this.records[record_number].cefr_level == this.daily_dose_level) {
                    records_with_this_level.push(record_number);
                }
            }
            let selected = random_selection(records_with_this_level, 5);
            selected.sort((a, b) => a - b);
            this.record_numbers_matching_search = selected;
        }
    }
})
