import OptionsSync from 'webext-options-sync';

export default new OptionsSync({
	defaults: {
		archivedUrls: {},
		errorMessage: ""
	},
	migrations: [
		OptionsSync.migrations.removeUnused,
	],
	logging: true,
	storageType: "local"
});
