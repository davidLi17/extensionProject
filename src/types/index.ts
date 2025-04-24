// 日志格式类型
enum LogFormatType {
	SHORT = "short", // 简短格式: index.tsx values:::
	FULL = "full", // 完整格式: src/pages/index.tsx values:::
	CUSTOM = "custom", // 自定义格式
}
enum LogType {
	LOG = "log",
	INFO = "info",
	WARN = "warn",
	ERROR = "error",
	DEBUG = "debug",
	TRACE = "trace",
	TABLE = "table",
	GROUP = "group",
	GROUPCOLLAPSED = "groupCollapsed",
	GROUPEND = "groupEnd",
	CLEAR = "clear",
	COUNT = "count",
	COUNTRESET = "countReset",
	TIME = "time",
	TIMEDLOG = "timeLog",
}
interface LogConfig {
	logMethod: string;
	varPilotSymbol: string;
	quotationMark: string;
	showLogSemicolon: boolean;
	showLineNumber: boolean;
	showFilePath: boolean;
	filePathType: LogFormatType;
	lineTagPosition: "begin" | "end";
	customFormat: string;
}
export { LogFormatType, LogType, LogConfig };
