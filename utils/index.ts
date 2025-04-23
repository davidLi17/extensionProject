function extractURLs(text: string): string[] { // 定义一个函数extractURLs，参数是一个字符串，返回一个字符串数组
    const urlRegex = /https?:\/\/[^\s]+/g; // 定义一个正则表达式，匹配以http或https开头，后面跟随非空白字符的字符串
    return text.match(urlRegex) || []; // 使用正则表达式匹配输入的文本，返回匹配到的结果数组，如果没有匹配到则返回空数组
}


const testCases = [ // 定义测试用例数组
    {
        description: 'should extract single URL', // 测试用例描述：应该提取单个URL
        text: 'Visit https://example.com for more info', // 测试输入文本
        expected: ['https://example.com'] // 预期输出结果
    },
    {
        description: 'should extract multiple URLs', // 测试用例描述：应该提取多个URL
        text: 'First http://site1.com then https://site2.com', // 测试输入文本
        expected: ['http://site1.com', 'https://site2.com'] // 预期输出结果
    },
    {
        description: 'should handle empty string input', // 测试用例描述：应该处理空字符串输入
        text: '', // 测试输入文本
        expected: [] // 预期输出结果
    },
    {
        description: 'should extract URLs with special characters', // 测试用例描述：应该提取包含特殊字符的URL
        text: 'Check https://api.example.com/data?id=123&type=test#section', // 测试输入文本
        expected: ['https://api.example.com/data?id=123&type=test#section'] // 预期输出结果
    },
    {
        description: 'should handle URLs with line breaks', // 测试用例描述：应该处理包含换行符的URL
        text: 'First line\nhttps://example.com\nThird line', // 测试输入文本
        expected: ['https://example.com'] // 预期输出结果
    },
    {
        description: 'should extract URLs surrounded by punctuation', // 测试用例描述：应该提取被标点符号包围的URL
        text: 'Visit (https://example.com), thanks!', // 测试输入文本
        expected: ['https://example.com'] // 预期输出结果
    }
];

testCases.forEach(({ description, text, expected }) => { // 遍历每个测试用例
    const urls = extractURLs(text); // 调用extractURLs函数提取URL
    console.log(description); // 打印测试用例描述
    console.log(urls); // 打印提取到的URL数组
});
